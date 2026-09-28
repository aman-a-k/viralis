import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { NotificationService } from '@/services/notifications';
import { requireSession } from '@/lib/apiAuth';
import { RepurposingService } from '@/services/repurposingService';
import { renderWorkerConfigured } from '@/lib/renderWorker';

// Starting a render can wait on a cold (spun-down) worker.
export const maxDuration = 60;

export async function POST(req: Request) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id, action } = await req.json();
    if (typeof id !== 'string' || !id) {
      return NextResponse.json({ success: false, error: 'id is required.' }, { status: 400 });
    }
    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
    }

    const item = await prisma.approvalQueue.findUnique({ where: { id } });
    if (!item) return NextResponse.json({ success: false, error: 'Item not found.' }, { status: 404 });

    if (action === 'reject') {
      await prisma.approvalQueue.update({ where: { id }, data: { status: 'rejected' } });
      // Let the clip be sent to the queue again later if the user changes their mind.
      if (item.clipId) {
        await prisma.clip.updateMany({ where: { id: item.clipId, status: 'approved' }, data: { status: 'candidate' } });
      }
      return NextResponse.json({ success: true, message: 'Rejected.' });
    }

    await prisma.approvalQueue.update({ where: { id }, data: { status: 'approved' } });

    // Autopilot scripts have no source clip to cut — there's no script ->
    // voiceover -> video pipeline yet, so don't claim otherwise.
    if (!item.clipId) {
      await NotificationService.sendDiscordNotification('Script approved', `"${item.topic}" is approved.`, 'success');
      return NextResponse.json({
        success: true,
        message: 'Approved. The script, captions and SEO metadata are saved — Autopilot doesn’t turn scripts into videos yet.',
      });
    }

    if (!renderWorkerConfigured()) {
      return NextResponse.json({
        success: true,
        message: 'Approved. Connect the render worker (see worker/README.md) to produce the actual video file.',
      });
    }

    // Repurposed clip: start cutting the real video. Rendering takes minutes,
    // so the browser polls /api/repurpose/render/status with the job id.
    try {
      const render = await RepurposingService.startRender(item.clipId);
      if (render.status === 'done') {
        await NotificationService.sendDiscordNotification('Clip rendered', `"${item.topic}" has a real cut ready.`, 'success');
        return NextResponse.json({ success: true, message: 'Approved and rendered — the clip is ready.', videoUrl: render.videoUrl });
      }
      return NextResponse.json({
        success: true,
        message: 'Approved — rendering the clip now.',
        render: { clipId: item.clipId, jobId: render.jobId },
      });
    } catch (renderErr) {
      const message = renderErr instanceof Error ? renderErr.message : 'Render failed.';
      await prisma.approvalQueue.update({ where: { id }, data: { renderStatus: 'failed', renderError: message } });
      return NextResponse.json({ success: true, message: `Approved, but rendering couldn’t start: ${message}` });
    }
  } catch (error: unknown) {
    console.error('[API /api/approval] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
