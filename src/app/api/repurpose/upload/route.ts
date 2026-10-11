import { NextResponse } from 'next/server';
import { requireWorkspace } from '@/lib/workspace';
import { errorResponse, badRequest } from '@/lib/http';
import { blobPathname } from '@/lib/storage';
import { ingestUpload, normalizeConfig, clampClipCount, projectView } from '@/services/pipeline';

export const maxDuration = 30;

/**
 * Starts processing a recording the browser already uploaded (via
 * /api/repurpose/upload-token). The worker transcribes it in the background;
 * follow progress with GET /api/projects/<id>.
 */
export async function POST(req: Request) {
  try {
    const ctx = await requireWorkspace({ verified: true });
    const body = await req.json().catch(() => ({}));
    const stored = typeof body.blobPath === 'string' ? body.blobPath : typeof body.mediaUrl === 'string' ? body.mediaUrl : '';
    if (!stored) throw badRequest('Upload a file first.');

    const project = await ingestUpload(
      { workspaceId: ctx.workspaceId, userId: ctx.userId, unlimited: ctx.isPlatformAdmin },
      {
        blobPath: blobPathname(stored),
        title: String(body.title || ''),
        durationSeconds: Number(body.durationSeconds) || 0,
        clipCount: clampClipCount(body.clipCount),
        config: normalizeConfig(body),
        rightsConfirmed: body.rightsConfirmed === true,
      }
    );
    return NextResponse.json({ success: true, project: await projectView(ctx.workspaceId, project.id) });
  } catch (error) {
    return errorResponse(error, 'Could not start processing this upload.', 'api/repurpose/upload');
  }
}
