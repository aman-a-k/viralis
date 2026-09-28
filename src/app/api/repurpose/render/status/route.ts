import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/apiAuth';
import { RepurposingService } from '@/services/repurposingService';

export const maxDuration = 30;

/** Checks a render job started by /api/repurpose/render; saves the video when done. */
export async function POST(req: Request) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  try {
    const { clipId, jobId } = await req.json();
    if (!clipId || !jobId) {
      return NextResponse.json({ success: false, error: 'clipId and jobId are required.' }, { status: 400 });
    }

    const job = await RepurposingService.checkRender(clipId, jobId);
    return NextResponse.json({ success: true, ...job });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
