import { NextResponse } from 'next/server';
import { RepurposingService } from '@/services/repurposingService';
import { requireSession } from '@/lib/apiAuth';

export async function POST(req: Request) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { clipId, aspectRatio = '9:16', captionStyle = 'Dynamic Pop' } = body;

    if (!clipId) {
      return NextResponse.json({ success: false, error: 'clipId is required' }, { status: 400 });
    }

    console.log(`[API /api/repurpose/render] Rendering real video for clip ${clipId} (${aspectRatio}, ${captionStyle})...`);
    const videoUrl = await RepurposingService.renderClip(clipId, aspectRatio, captionStyle);

    return NextResponse.json({
      success: true,
      videoUrl,
      message: `Rendered real ${aspectRatio} cut with ${captionStyle} captions.`,
    });
  } catch (error: any) {
    console.error('[API /api/repurpose/render] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
