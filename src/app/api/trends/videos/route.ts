import { NextResponse } from 'next/server';
import { requireWorkspace } from '@/lib/workspace';
import { errorResponse, HttpError } from '@/lib/http';
import { fetchTrendingVideos, MissingYouTubeKeyError } from '@/services/youtubeTrending';

export async function GET(req: Request) {
  try {
    await requireWorkspace();
    const { searchParams } = new URL(req.url);
    const page = await fetchTrendingVideos({
      regionCode: searchParams.get('region') || undefined,
      categoryId: searchParams.get('category') || undefined,
      maxResults: Number(searchParams.get('limit')) || undefined,
      pageToken: searchParams.get('pageToken') || undefined,
    });
    return NextResponse.json({ success: true, ...page });
  } catch (error) {
    if (error instanceof MissingYouTubeKeyError) return errorResponse(new HttpError(503, error.message));
    if (error instanceof Error && /YouTube API/.test(error.message)) return errorResponse(new HttpError(502, error.message));
    return errorResponse(error, 'Could not load trending videos.', 'api/trends/videos');
  }
}
