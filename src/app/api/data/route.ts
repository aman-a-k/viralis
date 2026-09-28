import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Settings } from '@prisma/client';
import { requireSession } from '@/lib/apiAuth';
import { resolveLlmConfig } from '@/lib/llm';
import { renderWorkerConfigured } from '@/lib/renderWorker';

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

    const settings: Partial<Settings> =
      (await prisma.settings.findFirst({ where: { id: 'default' } })) ?? {};

    const trends = await prisma.trend.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    const approvalQueue = await prisma.approvalQueue.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'desc' }
    });

    // Autopilot output (scripts, not videos) in every state, so the
    // Autopilot tab can show what a run produced even after it's reviewed.
    const autopilotScripts = await prisma.approvalQueue.findMany({
      where: { clipId: null },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    // Content Library: every clip that has a real rendered file.
    const renderedClips = await prisma.clip.findMany({
      where: { videoUrl: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: 60,
      select: {
        id: true,
        projectId: true,
        title: true,
        startTime: true,
        endTime: true,
        duration: true,
        viralityScore: true,
        hookType: true,
        videoUrl: true,
        status: true,
        createdAt: true,
        project: { select: { title: true, thumbnail: true } },
      },
    });

    const llm = await resolveLlmConfig();

    // Full transcripts (often 100KB+ each) are never shown on the dashboard
    // and this route is polled every 30s — leave them out.
    const projects = await prisma.project.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        sourceVideoUrl: true,
        sourceVideoId: true,
        sourceType: true,
        channel: true,
        thumbnail: true,
        duration: true,
        status: true,
        errorMessage: true,
        createdAt: true,
        updatedAt: true,
        clips: {
          orderBy: { viralityScore: 'desc' },
          include: { metrics: true },
        },
      },
      take: 10,
    });

    const totalClipsCount = await prisma.clip.count();

    const watchThrough = await prisma.metric.aggregate({ _avg: { watchThroughPct: true }, _count: true });
    const avgWatchThrough = watchThrough._count > 0 ? Math.round(watchThrough._avg.watchThroughPct ?? 0) : null;

    const agents = [
      {
        id: 'clipper-agent',
        name: 'Viralis Highlight AI',
        role: 'NLP Hook Detector',
        status: 'idle',
        lastAction: 'Ranks transcript moments by hook strength and scores each 0–100.',
        capabilities: ['Whisper Transcription', 'Hook Scoring', 'Virality Score (0-100)']
      },
      {
        id: 'reframe-agent',
        name: 'Reframe & Caption Renderer',
        role: 'Visual Editor',
        status: 'idle',
        lastAction: 'Cuts approved clips and burns captions in 9:16, 1:1 or 16:9.',
        capabilities: ['Center-crop Reframe', 'Burned-in Captions', '1080p Export']
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
        name: 'Trend Radar',
        role: 'Researcher',
        status: 'idle',
        lastAction: 'Pulls trending YouTube videos and Google Trends topics for your niche.',
        capabilities: ['YouTube Trending', 'Google Trends', 'Niche Filtering']
      },
      {
        id: 'feedback-agent',
        name: 'Learning Loop',
        role: 'Performance Analyst',
        status: 'idle',
        lastAction: 'Summarizes watch-through and drop-offs from published clip metrics.',
        capabilities: ['Watch-through Analysis', 'Hook Style Comparison', 'Drop-off Flags']
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
          subs: analytics.subscribersGained,
          avgWatchThrough,
        },
        settings: {
          youtubeId: settings.youtubeId || '',
          instagramId: settings.instagramId || '',
          brandName: settings.brandName || '',
          brandTone: settings.brandTone || '',
          targetAudience: settings.targetAudience || '',
          videoStyle: settings.videoStyle || '',
          // What getLlmClient() will actually use, so the badge can't claim a
          // key is set for a provider that won't be called with it.
          aiProvider: llm.provider,
          hasAiKey: Boolean(llm.key),
          aiKeySource: llm.keySource,
          aiModel: settings.aiModel || '',
          hasOpenAi: !!(settings.aiApiKey || settings.openAiKey),
          youtubeClientId: settings.youtubeClientId || '',
          hasYoutubeClientSecret: !!settings.youtubeClientSecret,
          hasYoutubeAuth: !!settings.youtubeRefreshToken,
          hasInstagramToken: !!settings.instagramAccessToken,
          hasDiscordWebhook: !!settings.discordWebhookUrl,
          hasPexelsKey: !!settings.pexelsApiKey,
          hasElevenLabsKey: !!settings.elevenLabsApiKey,
          hasYoutubeDataKey: !!(
            (settings as { youtubeDataApiKey?: string }).youtubeDataApiKey || process.env.YOUTUBE_API_KEY
          ),
          brandNiche: (settings as { brandNiche?: string }).brandNiche || 'Technology & AI',
          captionStyle: (settings as { captionStyle?: string }).captionStyle || 'Dynamic Pop',
          defaultPlatforms: (() => {
            try { return JSON.parse((settings as { defaultPlatforms?: string }).defaultPlatforms || '[]'); }
            catch { return ['instagram', 'youtube', 'linkedin', 'twitter', 'tiktok']; }
          })(),
          defaultOrientations: (() => {
            try { return JSON.parse((settings as { defaultOrientations?: string }).defaultOrientations || '[]'); }
            catch { return ['9:16', '1:1', '16:9']; }
          })(),
        },
        agents,
        trends,
        approvalQueue,
        autopilotScripts,
        renderedClips,
        renderWorkerConfigured: renderWorkerConfigured(),
      }
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
