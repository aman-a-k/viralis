import { NextResponse } from 'next/server';
import { describeLlmError } from '@/lib/llm';
import { RepurposingService } from '@/services/repurposingService';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';

export async function GET() {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  try {
    const projects = await prisma.project.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        clips: {
          orderBy: { viralityScore: 'desc' },
          include: { metrics: true },
        },
      },
    });

    return NextResponse.json({ success: true, projects });
  } catch (error: any) {
    console.error('[API /api/repurpose GET] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { title, sourceVideoUrl, transcriptText, clipCount, platforms, orientations, captionStyle } = body;

    if (!sourceVideoUrl && !transcriptText) {
      return NextResponse.json(
        { success: false, error: 'Paste a YouTube link or a full transcript.' },
        { status: 400 }
      );
    }

    const result = await RepurposingService.ingestVideo({
      title,
      sourceVideoUrl,
      transcriptText,
      desiredClipCount: Math.min(10, Math.max(3, Number(clipCount) || 5)),
      platforms: Array.isArray(platforms) && platforms.length ? platforms : undefined,
      orientations: Array.isArray(orientations) && orientations.length ? orientations : undefined,
      captionStyle,
    });

    return NextResponse.json({
      success: true,
      project: result.project,
      clips: result.clips,
      message: `Analyzed "${result.project.title}" — surfaced ${result.clips.length} clips.`,
    });
  } catch (error: unknown) {
    console.error('[API /api/repurpose POST] Error:', error);
    return NextResponse.json(
      { success: false, error: describeLlmError(error) },
      { status: 500 }
    );
  }
}
