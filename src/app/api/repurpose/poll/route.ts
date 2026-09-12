import { NextResponse } from 'next/server';
import { describeLlmError } from '@/lib/llm';
import { RepurposingService } from '@/services/repurposingService';
import { requireSession } from '@/lib/apiAuth';

// Checking a whisper.cpp transcription job's status is fast; the analysis
// step that runs once it's done is the same chain as /api/repurpose.
export const maxDuration = 60;

export async function POST(req: Request) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  try {
    const { projectId, autoQueue } = await req.json();
    if (!projectId) {
      return NextResponse.json({ success: false, error: 'projectId is required.' }, { status: 400 });
    }

    const result = await RepurposingService.pollTranscription(projectId, { autoQueue: Boolean(autoQueue) });
    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    console.error('[API /api/repurpose/poll POST] Error:', error);
    return NextResponse.json({ success: false, error: describeLlmError(error) }, { status: 500 });
  }
}
