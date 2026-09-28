import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/apiAuth';
import { RepurposingService } from '@/services/repurposingService';
import { RenderWorkerNotConfiguredError } from '@/lib/renderWorker';

// Starting a job can wait out a cold worker (~30-60s on Render's free tier).
export const maxDuration = 60;

const ASPECT_RATIOS = ['9:16', '1:1', '16:9'] as const;
const CAPTION_STYLES = ['Dynamic Pop', 'Minimalist'];

function clipState(clip: { id: string; renderStatus: string | null; renderError: string | null; videoUrl: string | null }) {
  return { clipId: clip.id, renderStatus: clip.renderStatus, renderError: clip.renderError, videoUrl: clip.videoUrl };
}

export async function POST(req: Request) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  try {
    const { clipId, aspectRatio = '9:16', captionStyle = 'Dynamic Pop' } = await req.json();
    if (typeof clipId !== 'string' || !clipId) {
      return NextResponse.json({ success: false, error: 'clipId is required' }, { status: 400 });
    }
    if (!ASPECT_RATIOS.includes(aspectRatio) || !CAPTION_STYLES.includes(captionStyle)) {
      return NextResponse.json({ success: false, error: 'Unsupported aspect ratio or caption style.' }, { status: 400 });
    }

    const clip = await RepurposingService.startRender(clipId, aspectRatio, captionStyle);
    return NextResponse.json({ success: true, ...clipState(clip) });
  } catch (error: unknown) {
    const status = error instanceof RenderWorkerNotConfiguredError ? 424 : 500;
    console.error('[API /api/repurpose/render POST]', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Could not start rendering.' },
      { status }
    );
  }
}

export async function GET(req: Request) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  const clipId = new URL(req.url).searchParams.get('clipId');
  if (!clipId) {
    return NextResponse.json({ success: false, error: 'clipId is required' }, { status: 400 });
  }
  try {
    const clip = await RepurposingService.pollRender(clipId);
    return NextResponse.json({ success: true, ...clipState(clip) });
  } catch (error: unknown) {
    console.error('[API /api/repurpose/render GET]', error);
    return NextResponse.json({ success: false, error: 'Could not check render status.' }, { status: 500 });
  }
}
