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

      // Repurposed clips: start rendering the real cut in the background.
      // Progress shows on the clip in Repurpose Studio.
      if (item.clipId && renderWorkerConfigured()) {
        try {
          await RepurposingService.startRender(item.clipId, '9:16', 'Dynamic Pop');
          await prisma.approvalQueue.update({ where: { id }, data: { renderStatus: 'rendering' } });
          return NextResponse.json({ success: true, message: 'Approved — rendering started. Track it on the clip in Repurpose Studio.' });
        } catch (renderErr) {
          const message = renderErr instanceof Error ? renderErr.message : 'Render failed to start.';
          await prisma.approvalQueue.update({ where: { id }, data: { renderStatus: 'failed', renderError: message } });
          return NextResponse.json({ success: true, message: `Approved, but rendering couldn't start: ${message}` });
        }
      }

      // No source clip — this is an Autopilot-generated script, which has no
      // video to cut. The render worker only cuts YouTube clips; there's no
      // script -> voiceover -> video pipeline yet, so don't claim otherwise
      // just because that (unrelated) worker happens to be configured.
      if (!item.clipId) {
        await prisma.video.create({ data: { topic: item.topic, videoUrl: '', platform: 'both', status: 'pending' } });
      }

      await NotificationService.sendDiscordNotification('Script approved', `"${item.topic}" is approved.`, 'success');

      return NextResponse.json({
        success: true,
        message: item.clipId
          ? (renderWorkerConfigured()
              ? 'Approved. Queued for rendering.'
              : 'Approved. Connect the render worker (see worker/README.md) to produce the actual video file.')
          : 'Approved. Autopilot video generation (script → voiceover → render) isn’t built yet, so this stays pending — the script and captions are saved for now.',
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (error: unknown) {
    console.error('[API /api/approval]', error);
    return NextResponse.json({ success: false, error: 'Could not update this item.' }, { status: 500 });
  }
}
