import { NextResponse } from 'next/server';
import { requireWorkspace, audit } from '@/lib/workspace';
import { errorResponse, badRequest } from '@/lib/http';
import { publishClipToYouTube, type Privacy } from '@/services/youtubePublisher';

// Streams the exported clip to YouTube.
export const maxDuration = 300;

const PRIVACIES: Privacy[] = ['public', 'unlisted', 'private'];

export async function POST(req: Request) {
  try {
    const ctx = await requireWorkspace({ verified: true });
    const { clipId, privacy = 'unlisted' } = await req.json().catch(() => ({}));
    if (typeof clipId !== 'string' || !clipId) throw badRequest('clipId is required.');
    if (!PRIVACIES.includes(privacy)) throw badRequest('Invalid privacy setting.');
    const record = await publishClipToYouTube(ctx.workspaceId, clipId, privacy);
    await audit(ctx, 'clip.publish', { clipId, privacy, postId: record.postId });
    return NextResponse.json({ success: true, postUrl: record.postUrl, message: 'Published to YouTube.' });
  } catch (error) {
    return errorResponse(error, 'Publishing failed.', 'api/repurpose/publish');
  }
}
