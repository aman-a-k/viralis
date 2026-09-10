import { NextResponse } from 'next/server';
import { describeLlmError } from '@/lib/llm';
import { RepurposingService } from '@/services/repurposingService';
import { requireSession } from '@/lib/apiAuth';

export async function POST(req: Request) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  try {
    const { projectId, clipCount } = await req.json();
    if (!projectId) {
      return NextResponse.json({ success: false, error: 'projectId is required.' }, { status: 400 });
    }

    const result = await RepurposingService.reanalyzeProject(
      projectId,
      Math.min(10, Math.max(3, Number(clipCount) || 5))
    );

    return NextResponse.json({
      success: true,
      project: result.project,
      clips: result.clips,
      message: `Re-analyzed — ${result.clips.length} clips.`,
    });
  } catch (error: unknown) {
    console.error('[API /api/repurpose/reanalyze] Error:', error);
    return NextResponse.json(
      { success: false, error: describeLlmError(error) },
      { status: 500 }
    );
  }
}
