import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/apiAuth';
import { runAutomaticDiscovery } from '@/services/automationService';
import { describeLlmError } from '@/lib/llm';
import { MissingYouTubeKeyError } from '@/services/youtubeTrending';

export async function POST(req: Request) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json().catch(() => ({}));
    const result = await runAutomaticDiscovery({
      platforms: body.platforms,
      orientations: body.orientations,
      captionStyle: body.captionStyle,
      clipCount: body.clipCount,
      region: body.region,
      category: body.category,
    });

    return NextResponse.json({
      success: true,
      result,
      message: `Picked "${result.video.title}" — ${result.clipsCreated} clips created, ${result.clipsQueued} queued for approval.`,
    });
  } catch (error: unknown) {
    const status = error instanceof MissingYouTubeKeyError ? 424 : 500;
    return NextResponse.json(
      { success: false, error: error instanceof MissingYouTubeKeyError ? error.message : describeLlmError(error) },
      { status }
    );
  }
}
