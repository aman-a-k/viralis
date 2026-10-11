import { NextResponse } from 'next/server';
import { requireWorkspace } from '@/lib/workspace';
import { errorResponse, HttpError } from '@/lib/http';
import { syncYouTubeMetrics, YouTubeNotConnectedError } from '@/services/youtubeStats';

export const maxDuration = 60;

export async function POST() {
  try {
    const ctx = await requireWorkspace();
    const result = await syncYouTubeMetrics(ctx.workspaceId);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof YouTubeNotConnectedError) return errorResponse(new HttpError(424, error.message));
    if (error instanceof Error) return errorResponse(new HttpError(502, error.message));
    return errorResponse(error, 'Could not sync metrics.', 'api/analytics/sync');
  }
}
