import { Readable } from 'node:stream';
import type { ReadableStream as NodeWebStream } from 'node:stream/web';
import { Prisma } from '@prisma/client';
import { google } from 'googleapis';
import { prisma } from '../lib/prisma';
import { HttpError, badRequest } from '../lib/http';
import { signedReadUrl } from '../lib/storage';
import { getYouTubeAuth, markConnectionError, YouTubeNotConnectedError } from './youtubeConnection';

export type Privacy = 'public' | 'unlisted' | 'private';
export { YouTubeNotConnectedError };

/** Turns Google API failures into something a customer can act on. */
export function describeYouTubeError(err: unknown): string {
  const e = err as {
    message?: string;
    response?: { data?: { error?: string | { message?: string; errors?: { reason?: string }[] } } };
  };
  const data = e?.response?.data?.error;
  const reason = typeof data === 'object' ? data?.errors?.[0]?.reason : undefined;
  const raw = (typeof data === 'string' ? data : data?.message) || e?.message || '';

  if (/invalid_grant/.test(raw)) return 'YouTube access expired or was revoked. Reconnect your channel in Settings.';
  if (reason === 'quotaExceeded' || /quota/i.test(raw)) {
    return 'YouTube’s daily upload limit for this service has been reached. Your clip is safe — try publishing again tomorrow, or download it and upload it yourself.';
  }
  if (reason === 'uploadLimitExceeded') return 'This channel hit YouTube’s upload limit for now. Try again later.';
  if (/insufficient|scope/i.test(raw)) return 'YouTube permissions are missing. Reconnect your channel in Settings.';
  return raw ? `YouTube rejected the upload: ${raw}` : 'Publishing to YouTube failed.';
}

function shortsTitle(title: string, isShort: boolean) {
  const base = title.replace(/[<>]/g, '').trim() || 'New clip';
  const suffix = isShort && !/#shorts/i.test(base) ? ' #Shorts' : '';
  return (base.slice(0, 100 - suffix.length) + suffix).trim();
}

// A publish that's been "in progress" this long almost certainly died with
// its request; it's released so the customer can retry.
const STALE_PUBLISH_MS = 30 * 60 * 1000;

/**
 * Uploads an approved, rendered clip to the workspace's connected channel.
 *
 * Exactly-once: a Schedule row with a unique lockKey ("<clipId>:youtube") is
 * created *before* uploading. A concurrent or repeated request hits the
 * unique constraint and gets the existing record instead of a second upload.
 */
export async function publishClipToYouTube(workspaceId: string, clipId: string, privacy: Privacy) {
  const clip = await prisma.clip.findFirst({ where: { id: clipId, workspaceId } });
  if (!clip) throw new HttpError(404, 'Clip not found.');
  const media = clip.renderBlobPath || clip.videoUrl;
  if (!media) throw badRequest('Export this clip before publishing it.');
  if (clip.status !== 'approved' && clip.status !== 'published') {
    throw badRequest('Approve this clip in the review queue before publishing it.');
  }

  const lockKey = `${clip.id}:youtube`;
  let record;
  try {
    record = await prisma.schedule.create({
      data: { workspaceId, clipId, platform: 'youtube', scheduledTime: new Date(), status: 'publishing', lockKey },
    });
  } catch (err) {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) throw err;
    const existing = await prisma.schedule.findUnique({ where: { lockKey } });
    if (existing?.status === 'published') return existing;
    if (existing && Date.now() - existing.updatedAt.getTime() < STALE_PUBLISH_MS) {
      throw new HttpError(409, 'This clip is already being published.', 'publish_in_progress');
    }
    if (existing) {
      await prisma.schedule.update({
        where: { id: existing.id },
        data: { status: 'failed', lockKey: null, error: 'Interrupted. Check your channel before retrying in case it was uploaded.' },
      });
    }
    return publishClipToYouTube(workspaceId, clipId, privacy);
  }

  try {
    const auth = await getYouTubeAuth(workspaceId);
    const mediaRes = await fetch(await signedReadUrl(media, 60 * 60));
    if (!mediaRes.ok || !mediaRes.body) throw new Error(`Couldn't read the exported clip (HTTP ${mediaRes.status}).`);

    let tags: string[] = [];
    try {
      tags = clip.publishTags ? JSON.parse(clip.publishTags) : [];
    } catch {
      tags = [];
    }
    let description = clip.publishDescription ?? '';
    if (!description) {
      try {
        description = JSON.parse(clip.captionVersions || '{}').youtube || '';
      } catch {
        description = '';
      }
    }
    if (!tags.length) tags = Array.from(new Set((description.match(/#([\p{L}\p{N}_]+)/gu) || []).map((t) => t.slice(1)))).slice(0, 15);

    const youtube = google.youtube({ version: 'v3', auth });
    const res = await youtube.videos.insert({
      part: ['snippet', 'status'],
      requestBody: {
        snippet: {
          title: shortsTitle(clip.publishTitle || clip.title, clip.duration <= 180),
          description: description.slice(0, 4900),
          tags,
          categoryId: '22',
        },
        status: {
          privacyStatus: privacy,
          // The customer declares these per clip; we never assume them.
          selfDeclaredMadeForKids: clip.madeForKids,
          containsSyntheticMedia: clip.containsSyntheticMedia,
        },
      },
      media: { mimeType: 'video/mp4', body: Readable.fromWeb(mediaRes.body as unknown as NodeWebStream) },
    });

    const videoId = res.data.id;
    if (!videoId) throw new Error('YouTube did not return a video id.');
    const now = new Date();
    const [updated] = await prisma.$transaction([
      prisma.schedule.update({
        where: { id: record.id },
        data: { status: 'published', publishedTime: now, postId: videoId, postUrl: `https://www.youtube.com/watch?v=${videoId}`, error: null },
      }),
      prisma.clip.update({ where: { id: clip.id }, data: { status: 'published' } }),
    ]);
    return updated;
  } catch (err) {
    const message = err instanceof YouTubeNotConnectedError ? err.message : describeYouTubeError(err);
    if (/expired or was revoked/.test(message)) await markConnectionError(workspaceId, message, true);
    await prisma.schedule.update({ where: { id: record.id }, data: { status: 'failed', error: message, lockKey: null } });
    throw new HttpError(err instanceof YouTubeNotConnectedError ? 424 : 502, message);
  }
}
