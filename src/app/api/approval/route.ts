import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { NotificationService } from '@/services/notifications';
import { requireSession } from '@/lib/apiAuth';
import { RepurposingService } from '@/services/repurposingService';
import { renderWorkerConfigured } from '@/lib/renderWorker';

// Rendering (when the worker is connected) can take a while.
export const maxDuration = 60;

export async function POST(req: Request) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id, action } = await req.json();

    if (action === 'reject') {
      await prisma.approvalQueue.update({ where: { id }, data: { status: 'rejected' } });
      return NextResponse.json({ success: true, message: 'Rejected.' });
    }

    if (action === 'approve') {
      const item = await prisma.approvalQueue.findUnique({ where: { id } });
      if (!item) return NextResponse.json({ success: false, error: 'Item not found.' }, { status: 404 });

      await prisma.approvalQueue.update({ where: { id }, data: { status: 'approved' } });

      // Repurposed clips (item.clipId set): render the real cut if the
      // worker is connected. Autopilot-generated scripts have no source
      // clip to cut — those just move to "pending" until a worker exists.
      if (item.clipId && renderWorkerConfigured()) {
        try {
          await prisma.approvalQueue.update({ where: { id }, data: { renderStatus: 'rendering' } });
          const videoUrl = await RepurposingService.renderClip(item.clipId, '9:16', 'Dynamic Pop');
          await prisma.approvalQueue.update({ where: { id }, data: { renderStatus: 'rendered' } });
          await NotificationService.sendDiscordNotification('Clip rendered', `"${item.topic}" has a real cut ready.`, 'success');
          return NextResponse.json({ success: true, message: 'Approved and rendered — the real clip is ready.', videoUrl });
        } catch (renderErr) {
          const message = renderErr instanceof Error ? renderErr.message : 'Render failed.';
          await prisma.approvalQueue.update({ where: { id }, data: { renderStatus: 'failed', renderError: message } });
          return NextResponse.json({ success: true, message: `Approved, but rendering failed: ${message}` });
        }
      }

      // No source clip, or no worker connected yet.
      if (!item.clipId) {
        await prisma.video.create({ data: { topic: item.topic, videoUrl: '', platform: 'both', status: 'pending' } });
      }

      await NotificationService.sendDiscordNotification('Script approved', `"${item.topic}" is approved.`, 'success');

      return NextResponse.json({
        success: true,
        message: renderWorkerConfigured()
          ? 'Approved. Queued for rendering.'
          : 'Approved. Connect the render worker (see worker/README.md) to produce the actual video file.',
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
