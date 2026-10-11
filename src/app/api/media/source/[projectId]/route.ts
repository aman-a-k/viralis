import { NextResponse } from 'next/server';
import { requireWorkspace, getOwnedProject } from '@/lib/workspace';
import { errorResponse, notFound } from '@/lib/http';
import { signedReadUrl } from '@/lib/storage';

type Params = { params: Promise<{ projectId: string }> };

/** Short-lived link to an uploaded recording (for the editor's preview player). */
export async function GET(_req: Request, { params }: Params) {
  try {
    const ctx = await requireWorkspace();
    const { projectId } = await params;
    const project = await getOwnedProject(ctx.workspaceId, projectId);
    const stored = project.sourceBlobPath || (project.sourceType !== 'youtube' ? project.sourceVideoUrl : null);
    if (!stored) throw notFound('This project has no uploaded recording.');
    const res = NextResponse.redirect(await signedReadUrl(stored, 2 * 60 * 60), 302);
    res.headers.set('Cache-Control', 'private, no-store');
    return res;
  } catch (error) {
    return errorResponse(error, 'Could not open this recording.', 'api/media/source');
  }
}
