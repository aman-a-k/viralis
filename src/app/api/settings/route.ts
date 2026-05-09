import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
        youtubeId, instagramId, openAiKey, youtubeClientId, youtubeClientSecret, 
        instagramAccessToken, brandName, brandNiche, brandTone, targetAudience, 
        discordWebhookUrl, pexelsApiKey, elevenLabsApiKey, pixabayApiKey, videoStyle, captionStyle 
    } = body;

    const settings = await prisma.settings.upsert({
      where: { id: 'default' },
      update: {
        youtubeId: youtubeId || null,
        instagramId: instagramId || null,
        openAiKey: openAiKey || null,
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
        captionStyle: captionStyle || null
      },
      create: {
        id: 'default',
        youtubeId: youtubeId || null,
        instagramId: instagramId || null,
        openAiKey: openAiKey || null,
        youtubeClientId: youtubeClientId || null,
        youtubeClientSecret: youtubeClientSecret || null,
        instagramAccessToken: instagramAccessToken || null
      }
    });

    return NextResponse.json({ success: true, settings });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
