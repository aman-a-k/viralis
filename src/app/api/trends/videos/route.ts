import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/apiAuth';
import { fetchTrendingVideos, MissingYouTubeKeyError } from '@/services/youtubeTrending';

export async function GET(req: Request) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const videos = await fetchTrendingVideos({
      regionCode: searchParams.get('region') || undefined,
      categoryId: searchParams.get('category') || undefined,
      maxResults: Number(searchParams.get('limit')) || undefined,
    });
    return NextResponse.json({ success: true, videos });
  } catch (error: unknown) {
    const status = error instanceof MissingYouTubeKeyError ? 424 : 500;
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status }
    );
  }
}
