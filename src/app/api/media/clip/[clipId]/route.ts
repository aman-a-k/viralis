import { NextResponse } from 'next/server';
import { requireWorkspace, getOwnedClip } from '@/lib/workspace';
import { errorResponse, notFound } from '@/lib/http';
import { signedReadUrl } from '@/lib/storage';

type Params = { params: Promise<{ clipId: string }> };

/** Short-lived link to a clip's exported video, for members of its workspace only. */
export async function GET(_req: Request, { params }: Params) {
  try {
    const ctx = await requireWorkspace();
    const { clipId } = await params;
    const clip = await getOwnedClip(ctx.workspaceId, clipId);
    const stored = clip.renderBlobPath || clip.videoUrl;
    if (!stored) throw notFound('This clip hasn’t been exported yet.');
    const res = NextResponse.redirect(await signedReadUrl(stored, 15 * 60), 302);
    res.headers.set('Cache-Control', 'private, no-store');
    return res;
  } catch (error) {
    return errorResponse(error, 'Could not open this video.', 'api/media/clip');
  }
}
