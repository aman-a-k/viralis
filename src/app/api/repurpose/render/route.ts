import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/apiAuth';
import { RepurposingService } from '@/services/repurposingService';
import { RenderWorkerNotConfiguredError } from '@/lib/renderWorker';

// Starting a job is quick, but a cold (spun-down) worker can take ~30-60s to
// answer the first request.
export const maxDuration = 60;

/**
 * Starts rendering a clip on the worker. Returns { status: 'rendering', jobId }
 * — poll /api/repurpose/render/status — or { status: 'done', videoUrl } when
 * the worker finished synchronously.
 */
export async function POST(req: Request) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  try {
    const { clipId, aspectRatio, captionStyle } = await req.json();
    if (!clipId) {
      return NextResponse.json({ success: false, error: 'clipId is required' }, { status: 400 });
    }

    const result = await RepurposingService.startRender(clipId, aspectRatio, captionStyle);
    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    const status = error instanceof RenderWorkerNotConfiguredError ? 424 : 500;
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status }
    );
  }
}
