import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { VideoAgent } from '@/agents/videoAgent';
import { PublisherAgent } from '@/agents/publisherAgent';
import { NotificationService } from '@/services/notifications';

export async function POST(req: Request) {
  try {
    const { id, action } = await req.json();

    if (action === 'reject') {
      await prisma.approvalQueue.update({
        where: { id },
        data: { status: 'rejected' }
      });
      return NextResponse.json({ success: true });
    }

    if (action === 'approve') {
      const item = await prisma.approvalQueue.findUnique({ where: { id } });
      if (!item) throw new Error("Item not found");

      // 1. Mark as approved
      await prisma.approvalQueue.update({
        where: { id },
        data: { status: 'approved' }
      });

      // 2. Trigger Video Production & Publishing asynchronously
      // In a real prod app, this would be a background job (BullMQ, etc.)
      // For now, we trigger it here.
      const videoAgent = new VideoAgent();
      const publisherAgent = new PublisherAgent();

      const productionData = {
        polished: { 
            polishedScript: item.script,
            title: item.seoTitle,
            description: item.seoDescription,
            tags: item.seoTags ? JSON.parse(item.seoTags) : []
        },
        original: { 
            topic: item.topic, 
            visualPrompts: JSON.parse(item.visualPrompts),
            captions: JSON.parse(item.captions)
        }
      };

      const videoResult = await videoAgent.run(productionData);
      if (videoResult.success) {
        await publisherAgent.run({
          videoPath: videoResult.data.videoPath,
          content: productionData
        });
        
        await NotificationService.sendDiscordNotification(
          "Content Published", 
          `"${item.topic}" has been approved and published to all platforms!`, 
          'success'
        );
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
