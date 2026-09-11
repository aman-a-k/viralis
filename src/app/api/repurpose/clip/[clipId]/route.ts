import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';

export async function PATCH(req: Request, { params }: { params: Promise<{ clipId: string }> }) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  try {
    const { clipId } = await params;
    const body = await req.json();
    const { action, scheduledTime, platform = 'instagram' } = body;

    const clip = await prisma.clip.findUnique({
      where: { id: clipId },
      include: { project: true },
    });

    if (!clip) {
      return NextResponse.json({ success: false, error: 'Clip not found' }, { status: 404 });
    }

    if (action === 'approve_to_queue') {
      // Add to ApprovalQueue model so it unifies with Autopilot videos
      let parsedCaptions: any = {};
      try {
        parsedCaptions = JSON.parse(clip.captionVersions);
      } catch (e) {
        parsedCaptions = { instagram: clip.captionVersions };
      }

      await prisma.approvalQueue.create({
        data: {
          topic: `[Repurposed] ${clip.title}`,
          script: clip.transcriptSegment,
          visualPrompts: JSON.stringify([
            `9:16 vertical reframe with face-tracking`,
            `Hormozi dynamic pop subtitles: ${clip.title}`,
          ]),
          captions: JSON.stringify([
            { startTime: 0, endTime: clip.duration, text: clip.transcriptSegment.slice(0, 100) },
          ]),
          seoTitle: parsedCaptions.youtube?.slice(0, 80) || clip.title,
          seoDescription: parsedCaptions.linkedin || parsedCaptions.instagram || clip.reasoning,
          seoTags: JSON.stringify(['shorts', 'viral', 'repurpose', 'clips']),
          status: 'pending',
        },
      });

      await prisma.clip.update({
        where: { id: clipId },
        data: { status: 'approved' },
      });

      return NextResponse.json({
        success: true,
        message: 'Clip sent to the approval queue with multi-platform copy.',
      });
    }

    if (action === 'schedule') {
      const scheduleTime = scheduledTime ? new Date(scheduledTime) : new Date(Date.now() + 3600 * 1000 * 4);

      const schedule = await prisma.schedule.create({
        data: {
          clipId: clip.id,
          platform,
          scheduledTime: scheduleTime,
          status: 'pending',
        },
      });

      await prisma.clip.update({
        where: { id: clipId },
        data: { status: 'scheduled' },
      });

      return NextResponse.json({
        success: true,
        schedule,
        message: `Clip scheduled for ${platform.toUpperCase()} at ${scheduleTime.toLocaleTimeString()}.`,
      });
    }

    if (action === 'reject') {
      await prisma.clip.update({
        where: { id: clipId },
        data: { status: 'rejected' },
      });

      return NextResponse.json({ success: true, message: 'Clip rejected.' });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('[API /api/repurpose/clip PATCH] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
