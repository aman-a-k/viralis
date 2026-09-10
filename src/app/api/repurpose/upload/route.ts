import { NextResponse } from 'next/server';
import { RepurposingService } from '@/services/repurposingService';
import { requireSession } from '@/lib/apiAuth';

/**
 * "Upload" now means: paste a transcript for analysis. Analyzing a raw video
 * file requires the media worker (transcription + processing), which is not
 * enabled on this deployment. YouTube links are handled by /api/repurpose.
 */
export async function POST(req: Request) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  try {
    const contentType = req.headers.get('content-type') || '';
    let title = '';
    let transcript = '';

    if (contentType.includes('application/json')) {
      const body = await req.json();
      title = body.title || '';
      transcript = body.transcript || body.transcriptText || '';
    } else {
      const form = await req.formData();
      title = (form.get('title') as string) || '';
      transcript = (form.get('transcript') as string) || '';
      if (form.get('video')) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Direct video-file analysis needs the media worker (transcription), which is not enabled here. Paste the transcript, or use a YouTube link.',
          },
          { status: 501 }
        );
      }
    }

    if (!transcript || transcript.trim().length < 200) {
      return NextResponse.json(
        { success: false, error: 'Paste a transcript of at least ~200 characters.' },
        { status: 400 }
      );
    }

    const result = await RepurposingService.ingestVideo({
      title: title || 'Pasted transcript',
      transcriptText: transcript,
    });

    return NextResponse.json({
      success: true,
      project: result.project,
      clips: result.clips,
      message: `Analyzed the transcript — surfaced ${result.clips.length} clips.`,
    });
  } catch (error: unknown) {
    console.error('[API /api/repurpose/upload] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
