import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/apiAuth';
import { syncYouTubeMetrics } from '@/services/youtubeStats';
import { describeYouTubeError, YouTubeNotConnectedError } from '@/services/youtubePublisher';

export const maxDuration = 60;

export async function POST() {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  try {
    const result = await syncYouTubeMetrics();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('[API /api/analytics/sync]', error);
    const message = error instanceof YouTubeNotConnectedError ? error.message : describeYouTubeError(error);
    return NextResponse.json({ success: false, error: message }, { status: error instanceof YouTubeNotConnectedError ? 424 : 500 });
  }
}
