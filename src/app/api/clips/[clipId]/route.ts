import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireWorkspace, getOwnedClip } from '@/lib/workspace';
import { errorResponse, badRequest } from '@/lib/http';
import { retimeEditedText, segmentsToWords, wordsInRange, wordsToText, parseWords, parseSegments } from '@/lib/captions';
import { sendToReview, serializeClip } from '@/services/pipeline';

type Params = { params: Promise<{ clipId: string }> };

const VISUAL_FIELDS = ['startTime', 'endTime', 'captionText', 'cropX', 'layout', 'captionPosition', 'captionStyle'];

/**
 * Editor saves and review actions for one clip.
 *
 * Body: any of { title, startTime, endTime, captionText, cropX, layout,
 * captionPosition, captionStyle, publishTitle, publishDescription,
 * publishTags, madeForKids, containsSyntheticMedia } and/or
 * { action: "send_to_review" | "reject" | "restore" }.
 */
export async function PATCH(req: Request, { params }: Params) {
  try {
    const ctx = await requireWorkspace();
    const { clipId } = await params;
    const clip = await getOwnedClip(ctx.workspaceId, clipId);
    const body = await req.json().catch(() => ({}));

    if (body.action === 'send_to_review') {
      await sendToReview(ctx, clip.id);
    } else if (body.action === 'reject') {
      if (clip.status === 'published') throw badRequest('Published clips can’t be rejected.');
      await prisma.$transaction([
        prisma.clip.update({ where: { id: clip.id }, data: { status: 'rejected' } }),
        prisma.approvalQueue.updateMany({ where: { clipId: clip.id, status: 'pending' }, data: { status: 'rejected' } }),
      ]);
    } else if (body.action === 'restore') {
      if (clip.status !== 'rejected') throw badRequest('Only rejected clips can be restored.');
      await prisma.clip.update({ where: { id: clip.id }, data: { status: 'candidate' } });
    } else if (body.action !== undefined) {
      throw badRequest('Unknown action.');
    }

    const data: Record<string, unknown> = {};
    if (typeof body.title === 'string') {
      if (!body.title.trim()) throw badRequest('Title can’t be empty.');
      data.title = body.title.trim().slice(0, 120);
    }

    // Trimming. The new window keeps any caption edits that still fall inside it.
    let start = clip.startTime;
    let end = clip.endTime;
    if (body.startTime !== undefined || body.endTime !== undefined) {
      start = Number(body.startTime ?? clip.startTime);
      end = Number(body.endTime ?? clip.endTime);
      const max = clip.project.duration && clip.project.duration > 0 ? clip.project.duration : Infinity;
      if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end > max + 0.5) throw badRequest('Those times are outside the recording.');
      if (end - start < 5) throw badRequest('A clip must be at least 5 seconds long.');
      if (end - start > 180) throw badRequest('A clip can be at most 3 minutes long.');
      start = Math.round(start * 10) / 10;
      end = Math.round(end * 10) / 10;
      Object.assign(data, { startTime: start, endTime: end, duration: Math.round(end - start) });
    }

    const transcriptWords = segmentsToWords(parseSegments(clip.project.transcriptJson));
    const edited = parseWords(clip.captionWords);
    let words = wordsInRange(transcriptWords, start, end);
    if (edited) {
      const kept = edited.filter((w) => (w.s + w.e) / 2 >= start && (w.s + w.e) / 2 < end);
      words = [
        ...words.filter((w) => w.e <= clip.startTime),
        ...kept,
        ...words.filter((w) => w.s >= clip.endTime),
      ];
    }
    if (typeof body.captionText === 'string') {
      if (body.captionText.length > 5000) throw badRequest('Captions are too long for one clip.');
      words = retimeEditedText(words, body.captionText, start, end);
    }
    if (typeof body.captionText === 'string' || ((data.startTime !== undefined || data.endTime !== undefined) && edited)) {
      data.captionWords = JSON.stringify(words);
    }
    if (data.startTime !== undefined || data.endTime !== undefined || typeof body.captionText === 'string') {
      data.transcriptSegment = wordsToText(words) || clip.title;
    }

    if (body.cropX !== undefined) {
      const x = Number(body.cropX);
      if (!Number.isFinite(x) || x < 0 || x > 1) throw badRequest('Crop position must be between 0 and 1.');
      data.cropX = x;
    }
    if (body.layout !== undefined) {
      if (!['fill', 'fit'].includes(body.layout)) throw badRequest('Unknown layout.');
      data.layout = body.layout;
    }
    if (body.captionPosition !== undefined) {
      if (!['top', 'middle', 'bottom'].includes(body.captionPosition)) throw badRequest('Unknown caption position.');
      data.captionPosition = body.captionPosition;
    }
    if (body.captionStyle !== undefined) {
      if (!['Dynamic Pop', 'Minimalist'].includes(body.captionStyle)) throw badRequest('Unknown caption style.');
      data.captionStyle = body.captionStyle;
    }
    if (typeof body.publishTitle === 'string') data.publishTitle = body.publishTitle.slice(0, 100);
    if (typeof body.publishDescription === 'string') data.publishDescription = body.publishDescription.slice(0, 5000);
    if (body.publishTags !== undefined) {
      if (!Array.isArray(body.publishTags)) throw badRequest('Tags must be a list.');
      const tags = body.publishTags.filter((t: unknown) => typeof t === 'string' && t.trim()).map((t: string) => t.trim().replace(/^#/, '').slice(0, 30)).slice(0, 15);
      data.publishTags = JSON.stringify(tags);
    }
    if (typeof body.madeForKids === 'boolean') data.madeForKids = body.madeForKids;
    if (typeof body.containsSyntheticMedia === 'boolean') data.containsSyntheticMedia = body.containsSyntheticMedia;

    // An existing export no longer matches once the picture or captions change.
    if (VISUAL_FIELDS.some((f) => body[f] !== undefined) && clip.renderStatus === 'rendered') {
      data.renderStatus = 'stale';
    }

    if (Object.keys(data).length) await prisma.clip.update({ where: { id: clip.id }, data });

    const updated = await prisma.clip.findUnique({
      where: { id: clip.id },
      include: { schedules: { where: { platform: 'youtube' }, orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    return NextResponse.json({ success: true, clip: serializeClip(updated!) });
  } catch (error) {
    return errorResponse(error, 'Could not update this clip.', 'api/clips PATCH');
  }
}

/** Editor data: the clip plus its exact caption words with timing. */
export async function GET(_req: Request, { params }: Params) {
  try {
    const ctx = await requireWorkspace();
    const { clipId } = await params;
    const clip = await getOwnedClip(ctx.workspaceId, clipId);
    const edited = parseWords(clip.captionWords);
    const words = edited || wordsInRange(segmentsToWords(parseSegments(clip.project.transcriptJson)), clip.startTime, clip.endTime);
    const full = await prisma.clip.findUnique({ where: { id: clip.id }, include: { schedules: { where: { platform: 'youtube' }, orderBy: { createdAt: 'desc' }, take: 1 } } });
    return NextResponse.json({
      success: true,
      clip: serializeClip(full!),
      words,
      projectDuration: clip.project.duration,
      source: clip.project.sourceType === 'youtube' ? { kind: 'youtube', videoId: clip.project.sourceVideoId } : clip.project.sourceBlobPath || clip.project.sourceVideoUrl ? { kind: 'file' } : { kind: 'none' },
    });
  } catch (error) {
    return errorResponse(error, 'Could not load this clip.', 'api/clips GET');
  }
}
