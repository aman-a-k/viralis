import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireWorkspace, getOwnedClip } from '@/lib/workspace';
import { errorResponse, badRequest } from '@/lib/http';
import { requestRender, isAspect, serializeClip } from '@/services/pipeline';

/** Queues an export (render) of a clip. Counts toward the plan's exports. */
export async function POST(req: Request) {
  try {
    const ctx = await requireWorkspace({ verified: true });
    const { clipId, aspectRatio = '9:16' } = await req.json().catch(() => ({}));
    if (!isAspect(aspectRatio)) throw badRequest('Unsupported aspect ratio.');
    const clip = await requestRender({ workspaceId: ctx.workspaceId, userId: ctx.userId, unlimited: ctx.isPlatformAdmin }, String(clipId || ''), aspectRatio);
    const full = await prisma.clip.findUnique({ where: { id: clip.id }, include: { schedules: { where: { platform: 'youtube' }, orderBy: { createdAt: 'desc' }, take: 1 } } });
    return NextResponse.json({ success: true, clip: serializeClip(full!) });
  } catch (error) {
    return errorResponse(error, 'Could not start the export.', 'api/repurpose/render');
  }
}

/** Export status for one clip. */
export async function GET(req: Request) {
  try {
    const ctx = await requireWorkspace();
    const clip = await getOwnedClip(ctx.workspaceId, new URL(req.url).searchParams.get('clipId'));
    const job = clip.renderJobId ? await prisma.job.findUnique({ where: { id: clip.renderJobId }, select: { status: true, progress: true } }) : null;
    const full = await prisma.clip.findUnique({ where: { id: clip.id }, include: { schedules: { where: { platform: 'youtube' }, orderBy: { createdAt: 'desc' }, take: 1 } } });
    return NextResponse.json({ success: true, clip: serializeClip(full!), progress: job?.progress || null });
  } catch (error) {
    return errorResponse(error, 'Could not check the export.', 'api/repurpose/render GET');
  }
}
