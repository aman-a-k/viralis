import { NextResponse } from 'next/server';
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
    const { title, sourceVideoUrl, sourceType, transcriptText } = body;

    if (!title && !sourceVideoUrl) {
      return NextResponse.json(
        { success: false, error: 'Please provide a title or a video URL.' },
        { status: 400 }
      );
    }

    const result = await RepurposingService.ingestVideo({
      title: title || 'Repurposed Masterclass',
      sourceVideoUrl,
      sourceType: sourceType || (sourceVideoUrl ? 'youtube' : 'upload'),
      transcriptText,
    });

    return NextResponse.json({
      success: true,
      project: result.project,
      clips: result.clips,
      message: `Extracted ${result.clips.length} high-virality highlights from video.`,
    });
  } catch (error: any) {
    console.error('[API /api/repurpose POST] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
