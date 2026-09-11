import { NextResponse } from 'next/server';
import { describeLlmError } from '@/lib/llm';
import { RepurposingService } from '@/services/repurposingService';
import { requireSession } from '@/lib/apiAuth';

// Analysis chains multiple LLM calls; allow up to the Hobby-plan max.
export const maxDuration = 60;

export async function POST(req: Request) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  try {
    const { projectId, clipCount, platforms, orientations, captionStyle } = await req.json();
    if (!projectId) {
      return NextResponse.json({ success: false, error: 'projectId is required.' }, { status: 400 });
    }

    const result = await RepurposingService.reanalyzeProject(
      projectId,
      Math.min(10, Math.max(3, Number(clipCount) || 5)),
      {
        platforms: Array.isArray(platforms) && platforms.length ? platforms : undefined,
        orientations: Array.isArray(orientations) && orientations.length ? orientations : undefined,
        captionStyle,
      }
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
