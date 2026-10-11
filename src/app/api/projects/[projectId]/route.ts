import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireWorkspace, getOwnedProject, audit } from '@/lib/workspace';
import { errorResponse, notFound } from '@/lib/http';
import { deleteMedia } from '@/lib/storage';
import { projectView, kickAnalysis, cancelProjectProcessing } from '@/services/pipeline';

export const maxDuration = 60;

type Params = { params: Promise<{ projectId: string }> };

/** Project status + clips. Also nudges a waiting analysis forward. */
export async function GET(_req: Request, { params }: Params) {
  try {
    const ctx = await requireWorkspace();
    const { projectId } = await params;
    const view = await projectView(ctx.workspaceId, projectId);
    if (!view) throw notFound('Project not found.');
    if (view.status === 'analyzing') kickAnalysis(undefined, projectId);
    return NextResponse.json({ success: true, project: view });
  } catch (error) {
    return errorResponse(error, 'Could not load this project.', 'api/projects GET');
  }
}

/** Rename. */
export async function PATCH(req: Request, { params }: Params) {
  try {
    const ctx = await requireWorkspace();
    const { projectId } = await params;
    const project = await getOwnedProject(ctx.workspaceId, projectId);
    const body = await req.json().catch(() => ({}));
    if (typeof body.title === 'string' && body.title.trim()) {
      await prisma.project.update({ where: { id: project.id }, data: { title: body.title.trim().slice(0, 200) } });
    }
    return NextResponse.json({ success: true, project: await projectView(ctx.workspaceId, project.id) });
  } catch (error) {
    return errorResponse(error, 'Could not update this project.', 'api/projects PATCH');
  }
}

/** Deletes the project, its clips, and its stored media; stops any processing. */
export async function DELETE(req: Request, { params }: Params) {
  try {
    const ctx = await requireWorkspace();
    const { projectId } = await params;
    const project = await getOwnedProject(ctx.workspaceId, projectId);
    await cancelProjectProcessing(ctx.workspaceId, project.id);
    const clips = await prisma.clip.findMany({ where: { projectId: project.id }, select: { renderBlobPath: true, videoUrl: true } });
    await deleteMedia([project.sourceBlobPath, ...clips.flatMap((c) => [c.renderBlobPath, c.videoUrl])]);
    await prisma.approvalQueue.deleteMany({ where: { workspaceId: ctx.workspaceId, clipId: { in: (await prisma.clip.findMany({ where: { projectId: project.id }, select: { id: true } })).map((c) => c.id) } } });
    await prisma.project.delete({ where: { id: project.id } });
    await audit(ctx, 'project.delete', { projectId: project.id, title: project.title });
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, 'Could not delete this project.', 'api/projects DELETE');
  }
}
