import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/apiAuth';
import { RepurposingService } from '@/services/repurposingService';
import { RenderWorkerNotConfiguredError } from '@/lib/renderWorker';

// Downloading + cutting + uploading can take a while; allow up to the
// Hobby-plan max.
export const maxDuration = 60;

export async function POST(req: Request) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  try {
    const { clipId, aspectRatio = '9:16', captionStyle = 'Dynamic Pop' } = await req.json();
    if (!clipId) {
      return NextResponse.json({ success: false, error: 'clipId is required' }, { status: 400 });
    }

    const videoUrl = await RepurposingService.renderClip(clipId, aspectRatio, captionStyle);

    return NextResponse.json({
      success: true,
      videoUrl,
      message: `Rendered a real ${aspectRatio} cut with burned-in captions.`,
    });
  } catch (error: unknown) {
    const status = error instanceof RenderWorkerNotConfiguredError ? 424 : 500;
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status }
    );
  }
}
