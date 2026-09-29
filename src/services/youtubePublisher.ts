import { Readable } from 'node:stream';
import type { ReadableStream as NodeWebStream } from 'node:stream/web';
import { google } from 'googleapis';
import { prisma } from '../lib/prisma';

export type Privacy = 'public' | 'unlisted' | 'private';

export class YouTubeNotConnectedError extends Error {
  constructor(message = 'Connect your YouTube account in Settings first.') {
    super(message);
    this.name = 'YouTubeNotConnectedError';
  }
}

/** OAuth client for the connected channel, or throws if nothing is connected. */
export async function getYouTubeAuth() {
  const settings = await prisma.settings.findFirst({ where: { id: 'default' } });
  if (!settings?.youtubeClientId || !settings.youtubeClientSecret || !settings.youtubeRefreshToken) {
    throw new YouTubeNotConnectedError();
  }
  const auth = new google.auth.OAuth2(settings.youtubeClientId, settings.youtubeClientSecret);
  auth.setCredentials({ refresh_token: settings.youtubeRefreshToken });
  return auth;
}

/** Turns Google API failures into something a user can act on. */
export function describeYouTubeError(err: unknown): string {
  const e = err as {
    message?: string;
    response?: { data?: { error?: string | { message?: string; errors?: { reason?: string }[] } } };
  };
  const data = e?.response?.data?.error;
  const reason = typeof data === 'object' ? data?.errors?.[0]?.reason : undefined;
  const raw = (typeof data === 'string' ? data : data?.message) || e?.message || '';

  if (/invalid_grant/.test(raw)) {
    return 'YouTube access expired or was revoked. Reconnect YouTube in Settings. (If your Google Cloud consent screen is in "Testing", connections expire every 7 days — switch it to "In production".)';
  }
  if (reason === 'quotaExceeded' || /quota/i.test(raw)) {
    return 'YouTube’s daily API quota is used up (an upload costs about 1,600 of the free 10,000 units). Try again tomorrow, or request a higher quota from Google.';
  }
  if (reason === 'uploadLimitExceeded') return 'This channel hit YouTube’s upload limit for now. Try again later.';
  if (/insufficient|scope/i.test(raw)) return 'YouTube permissions are missing. Reconnect YouTube in Settings.';
  return raw ? `YouTube rejected the upload: ${raw}` : 'Publishing to YouTube failed.';
}

function shortsTitle(title: string, isShort: boolean) {
  const base = title.replace(/[<>]/g, '').trim() || 'New clip';
  const suffix = isShort && !/#shorts/i.test(base) ? ' #Shorts' : '';
  return (base.slice(0, 100 - suffix.length) + suffix).trim();
}

/**
 * Uploads a rendered clip to the connected YouTube channel and records the
 * result in the Schedule table (our publish log). Idempotent: a clip that's
 * already published returns its existing record instead of uploading twice.
 */
export async function publishClipToYouTube(clipId: string, privacy: Privacy) {
  const clip = await prisma.clip.findUnique({ where: { id: clipId } });
  if (!clip) throw new Error('Clip not found.');
  if (!clip.videoUrl) throw new Error('Render this clip before publishing it.');

  const existing = await prisma.schedule.findFirst({
    where: { clipId, platform: 'youtube', status: 'published' },
  });
  if (existing) return existing;

  const auth = await getYouTubeAuth();

  let captions: Record<string, string> = {};
  try {
    captions = JSON.parse(clip.captionVersions || '{}');
  } catch {
    /* fall back to the clip title */
  }
  const description = (captions.youtube || clip.title).slice(0, 4900);
  const tags = Array.from(new Set((description.match(/#(\w+)/g) || []).map((t) => t.slice(1)))).slice(0, 15);

  try {
    const media = await fetch(clip.videoUrl);
    if (!media.ok || !media.body) throw new Error(`Couldn't read the rendered clip (HTTP ${media.status}).`);

    const youtube = google.youtube({ version: 'v3', auth });
    const res = await youtube.videos.insert({
      part: ['snippet', 'status'],
      requestBody: {
        snippet: {
          title: shortsTitle(clip.title, clip.duration <= 180),
          description,
          tags,
          categoryId: '22',
        },
        status: { privacyStatus: privacy, selfDeclaredMadeForKids: false },
      },
      media: {
        mimeType: 'video/mp4',
        body: Readable.fromWeb(media.body as unknown as NodeWebStream),
      },
    });

    const videoId = res.data.id;
    if (!videoId) throw new Error('YouTube did not return a video id.');
    const now = new Date();

    const [record] = await prisma.$transaction([
      prisma.schedule.create({
        data: {
          clipId,
          platform: 'youtube',
          scheduledTime: now,
          publishedTime: now,
          status: 'published',
          postId: videoId,
          postUrl: `https://www.youtube.com/watch?v=${videoId}`,
        },
      }),
      prisma.clip.update({ where: { id: clipId }, data: { status: 'published' } }),
    ]);
    return record;
  } catch (err) {
    const message = err instanceof YouTubeNotConnectedError ? err.message : describeYouTubeError(err);
    await prisma.schedule.create({
      data: { clipId, platform: 'youtube', scheduledTime: new Date(), status: 'failed', error: message },
    });
    throw new Error(message);
  }
}
