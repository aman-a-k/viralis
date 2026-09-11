import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';

export async function GET() {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

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

    const trends = await prisma.trend.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    const approvalQueue = await prisma.approvalQueue.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'desc' }
    });

    const projects = await prisma.project.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        clips: {
          orderBy: { viralityScore: 'desc' },
          include: { metrics: true },
        },
      },
      take: 10,
    });

    const totalClipsCount = await prisma.clip.count();

    const agents = [
      {
        id: 'clipper-agent',
        name: 'Viralis Highlight AI',
        role: 'NLP Hook Detector',
        status: 'idle',
        lastAction: 'Scanned 12 candidate moments for curiosity gaps and peak sentiment.',
        capabilities: ['Whisper Diarization', 'Hook Scoring', 'Virality Analysis (0-100)']
      },
      {
        id: 'reframe-agent',
        name: 'AutoReframe & Subtitle Engine',
        role: 'Visual Editor',
        status: 'idle',
        lastAction: 'Ready to burn Hormozi Dynamic Pop subtitles in 9:16 vertical format.',
        capabilities: ['Face Tracking 9:16', 'Word-by-word Captions', '4K Concat']
      },
      {
        id: 'copy-agent',
        name: 'Platform Copywriter',
        role: 'Distribution Strategist',
        status: 'idle',
        lastAction: 'Adapted tone matrix for Instagram Reels, Shorts, LinkedIn, X, and TikTok.',
        capabilities: ['Tone Optimization', 'Hashtag Clusters', 'SEO Metadata']
      },
      {
        id: 'trend-agent',
        name: 'Trend Radar & Back-Catalog Scout',
        role: 'Researcher',
        status: 'idle',
        lastAction: 'Monitoring Google Trends & cross-referencing video archive.',
        capabilities: ['Google Trends', 'Back-Catalog Sourcing', 'Niche Discovery']
      },
      {
        id: 'feedback-agent',
        name: 'Learning Loop & Healer',
        role: 'Self-Optimizer',
        status: 'idle',
        lastAction: 'Ingesting retention curves and re-weighting highlight detection priorities.',
        capabilities: ['Root-Cause Tagging', 'Dynamic Weight Tuning', 'Audience Analytics']
      }
    ];

    return NextResponse.json({
      success: true,
      data: {
        videos,
        projects,
        totalClipsCount,
        stats: {
          totalGenerated: videos.length + totalClipsCount,
          successCount: successVideos.length + totalClipsCount,
          failedCount: failedVideos.length,
          revenue: analytics.totalRevenue,
          views: analytics.totalViews,
          engagement: analytics.engagementRate,
          subs: analytics.subscribersGained
        },
        settings: {
          instagramId: settings.instagramId || '',
          aiProvider: (settings as { aiProvider?: string }).aiProvider || 'gemini',
          hasAiKey: !!((settings as { aiApiKey?: string }).aiApiKey || settings.openAiKey),
          aiModel: (settings as { aiModel?: string }).aiModel || '',
          hasOpenAi: !!((settings as { aiApiKey?: string }).aiApiKey || settings.openAiKey),
          openAiKey: '',
          youtubeClientId: settings.youtubeClientId || '',
          youtubeClientSecret: settings.youtubeClientSecret || '',
          hasYoutubeAuth: !!settings.youtubeRefreshToken,
          instagramAccessToken: settings.instagramAccessToken || ''
        },
        agents,
        trends,
        approvalQueue
      }
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
