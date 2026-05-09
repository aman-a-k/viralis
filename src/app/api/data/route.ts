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

    const settings = await prisma.settings.findFirst({ where: { id: 'default' } }) || {
      youtubeId: '',
      instagramId: '',
      openAiKey: '',
      youtubeClientId: '',
      youtubeClientSecret: '',
      youtubeRefreshToken: '',
      instagramAccessToken: ''
    };

    const agents = [
      {
        id: 'trend-agent',
        name: 'TrendIntelligence',
        role: 'Researcher',
        status: 'idle',
        lastAction: 'Waiting for daily trend fetch...',
        capabilities: ['Google Trends', 'Viral Analysis', 'Niche Discovery']
      },
      {
        id: 'content-agent',
        name: 'CreativeContent',
        role: 'Strategist',
        status: 'idle',
        lastAction: 'Ready to write scripts...',
        capabilities: ['Scriptwriting', 'Hook Optimization', 'Visual Prompting']
      },
      {
        id: 'video-agent',
        name: 'VideoProduction',
        role: 'Editor',
        status: 'idle',
        lastAction: 'Waiting for script input...',
        capabilities: ['FFmpeg', 'TTS Generation', 'Captioning']
      }
    ];

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
