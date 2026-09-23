import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';

// Plain fields: only touched when the client sends them; '' clears.
function field(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

// Secrets are never sent to the browser, so a blank input means "keep what's
// saved". Sending null explicitly clears it.
function secret(v: unknown): string | null | undefined {
  if (v === null) return null;
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

export async function POST(req: Request) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();

    const normalizedProvider = ['openai', 'gemini', 'groq'].includes(body.aiProvider) ? body.aiProvider : undefined;

    const data = {
      youtubeId: field(body.youtubeId),
      instagramId: field(body.instagramId),
      aiProvider: normalizedProvider,
      aiModel: field(body.aiModel),
      youtubeClientId: field(body.youtubeClientId),
      brandName: field(body.brandName),
      brandNiche: field(body.brandNiche),
      brandTone: field(body.brandTone),
      targetAudience: field(body.targetAudience),
      videoStyle: field(body.videoStyle),
      captionStyle: field(body.captionStyle),
      defaultPlatforms: Array.isArray(body.defaultPlatforms) ? JSON.stringify(body.defaultPlatforms) : undefined,
      defaultOrientations: Array.isArray(body.defaultOrientations) ? JSON.stringify(body.defaultOrientations) : undefined,

      openAiKey: secret(body.openAiKey),
      aiApiKey: secret(body.aiApiKey),
      youtubeClientSecret: secret(body.youtubeClientSecret),
      instagramAccessToken: secret(body.instagramAccessToken),
      youtubeDataApiKey: secret(body.youtubeDataApiKey),
      discordWebhookUrl: secret(body.discordWebhookUrl),
      pexelsApiKey: secret(body.pexelsApiKey),
      elevenLabsApiKey: secret(body.elevenLabsApiKey),
      pixabayApiKey: secret(body.pixabayApiKey),
    };

    if (data.discordWebhookUrl && !/^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\//.test(data.discordWebhookUrl)) {
      return NextResponse.json({ success: false, error: 'That doesn\'t look like a Discord webhook URL.' }, { status: 400 });
    }

    await prisma.settings.upsert({
      where: { id: 'default' },
      update: data,
      create: {
        id: 'default',
        ...Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined && v !== null)),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Saving settings failed:', error);
    return NextResponse.json({ success: false, error: 'Could not save settings.' }, { status: 500 });
  }
}
