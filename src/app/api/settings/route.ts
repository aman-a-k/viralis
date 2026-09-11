import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';

export async function POST(req: Request) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const {
        youtubeId, instagramId, openAiKey, youtubeClientId, youtubeClientSecret,
        instagramAccessToken, brandName, brandNiche, brandTone, targetAudience,
        discordWebhookUrl, pexelsApiKey, elevenLabsApiKey, pixabayApiKey, videoStyle, captionStyle,
        aiProvider, aiApiKey, aiModel, youtubeDataApiKey, defaultPlatforms, defaultOrientations
    } = body;

    const normalizedProvider = ['openai', 'gemini', 'groq'].includes(aiProvider) ? aiProvider : undefined;

    const settings = await prisma.settings.upsert({
      where: { id: 'default' },
      update: {
        youtubeId: youtubeId || null,
        instagramId: instagramId || null,
        openAiKey: openAiKey || null,
        aiProvider: normalizedProvider ?? undefined,
        aiApiKey: aiApiKey !== undefined ? (aiApiKey || null) : undefined,
        aiModel: aiModel !== undefined ? (aiModel || null) : undefined,
        youtubeClientId: youtubeClientId || null,
        youtubeClientSecret: youtubeClientSecret || null,
        instagramAccessToken: instagramAccessToken || null,
        brandName: brandName || null,
        brandNiche: brandNiche || null,
        brandTone: brandTone || null,
        targetAudience: targetAudience || null,
        discordWebhookUrl: discordWebhookUrl || null,
        pexelsApiKey: pexelsApiKey || null,
        elevenLabsApiKey: elevenLabsApiKey || null,
        pixabayApiKey: pixabayApiKey || null,
        videoStyle: videoStyle || null,
        captionStyle: captionStyle || null,
        youtubeDataApiKey: youtubeDataApiKey !== undefined ? (youtubeDataApiKey || null) : undefined,
        defaultPlatforms: Array.isArray(defaultPlatforms) ? JSON.stringify(defaultPlatforms) : undefined,
        defaultOrientations: Array.isArray(defaultOrientations) ? JSON.stringify(defaultOrientations) : undefined,
      },
      create: {
        id: 'default',
        youtubeId: youtubeId || null,
        instagramId: instagramId || null,
        openAiKey: openAiKey || null,
        aiProvider: normalizedProvider ?? 'gemini',
        aiApiKey: aiApiKey || null,
        aiModel: aiModel || null,
        youtubeClientId: youtubeClientId || null,
        youtubeClientSecret: youtubeClientSecret || null,
        instagramAccessToken: instagramAccessToken || null,
        youtubeDataApiKey: youtubeDataApiKey || null,
        defaultPlatforms: Array.isArray(defaultPlatforms) ? JSON.stringify(defaultPlatforms) : undefined,
        defaultOrientations: Array.isArray(defaultOrientations) ? JSON.stringify(defaultOrientations) : undefined,
      }
    });

    return NextResponse.json({ success: true, settings });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
