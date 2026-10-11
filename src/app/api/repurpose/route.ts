import { NextResponse } from 'next/server';
import { requireWorkspace } from '@/lib/workspace';
import { errorResponse, badRequest } from '@/lib/http';
import { ingestYouTube, ingestTranscript, normalizeConfig, clampClipCount, projectView } from '@/services/pipeline';

// Starting work can include a direct caption fetch; analysis itself runs in
// the background and is followed via GET /api/projects/<id>.
export const maxDuration = 60;

/** Starts a project from a YouTube link or a pasted transcript. */
export async function POST(req: Request) {
  try {
    const ctx = await requireWorkspace({ verified: true });
    const body = await req.json().catch(() => ({}));
    const actor = { workspaceId: ctx.workspaceId, userId: ctx.userId, unlimited: ctx.isPlatformAdmin };
    const config = normalizeConfig(body);
    const clipCount = clampClipCount(body.clipCount);

    let project;
    if (typeof body.sourceVideoUrl === 'string' && body.sourceVideoUrl.trim()) {
      project = await ingestYouTube(actor, { url: body.sourceVideoUrl.trim(), clipCount, config, rightsConfirmed: body.rightsConfirmed === true });
    } else if (typeof body.transcriptText === 'string') {
      project = await ingestTranscript(actor, { title: String(body.title || ''), text: body.transcriptText, clipCount, config });
    } else {
      throw badRequest('Paste a YouTube link or a transcript.');
    }
    return NextResponse.json({ success: true, project: await projectView(ctx.workspaceId, project.id) });
  } catch (error) {
    return errorResponse(error, 'Could not start this project.', 'api/repurpose');
  }
}
