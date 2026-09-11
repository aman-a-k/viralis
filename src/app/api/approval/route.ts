import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { NotificationService } from '@/services/notifications';
import { requireSession } from '@/lib/apiAuth';

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

      // The script + metadata are approved. Rendering the actual MP4 and
      // publishing run on the media worker (not part of this deployment), so we
      // record the video as pending render rather than shelling out to ffmpeg.
      await prisma.video.create({
        data: {
          topic: item.topic,
          videoUrl: '',
          platform: 'both',
          status: 'pending',
        },
      });

      await NotificationService.sendDiscordNotification(
        'Script approved',
        `"${item.topic}" is approved and queued for rendering.`,
        'success'
      );

      return NextResponse.json({
        success: true,
        message: 'Approved. Script is queued for rendering on the media worker.',
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
