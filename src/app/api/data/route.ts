import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const videos = await prisma.video.findMany({
      orderBy: { createdAt: 'desc' }
    });
    
    const successVideos = videos.filter((v) => v.status === 'success');
    const failedVideos = videos.filter((v) => v.status === 'failed');

    let analytics = await prisma.analytics.findFirst();
    if (!analytics) {
      analytics = await prisma.analytics.create({
        data: { totalViews: 0, totalRevenue: 0, engagementRate: 0, subscribersGained: 0 }
      });
    }

    let settings = await prisma.settings.findFirst({ where: { id: 'default' } });
    if (!settings) {
      settings = await prisma.settings.create({ data: { id: 'default' } });
    }

    return NextResponse.json({
      success: true,
      data: {
        videos,
        stats: {
          totalGenerated: videos.length,
          successCount: successVideos.length,
          failedCount: failedVideos.length,
          revenue: analytics.totalRevenue,
          views: analytics.totalViews,
          engagement: analytics.engagementRate,
          subs: analytics.subscribersGained
        },
        settings: {
          youtubeId: settings.youtubeId || '',
          instagramId: settings.instagramId || '',
          hasOpenAi: !!settings.openAiKey,
          openAiKey: settings.openAiKey || '',
          youtubeClientId: settings.youtubeClientId || '',
          youtubeClientSecret: settings.youtubeClientSecret || '',
          hasYoutubeAuth: !!settings.youtubeRefreshToken,
          instagramAccessToken: settings.instagramAccessToken || ''
        }
      }
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
