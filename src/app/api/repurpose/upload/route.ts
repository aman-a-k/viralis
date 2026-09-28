import { NextResponse } from 'next/server';
import { describeLlmError } from '@/lib/llm';
import { RepurposingService } from '@/services/repurposingService';
import { requireSession } from '@/lib/apiAuth';
import { isBlobUrl } from '@/lib/blob';

// Analysis chains multiple LLM calls, and starting a transcription job can
// wait out a cold worker; allow up to the Hobby-plan max.
export const maxDuration = 60;

/**
 * Two ways in:
 * - { mediaUrl, title }: a video the browser already uploaded to Vercel Blob
 *   (via /api/repurpose/upload-token). The worker transcribes it; the client
 *   then polls /api/repurpose/poll like the YouTube flow.
 * - { transcript, title }: a pasted transcript, analyzed immediately.
 */
export async function POST(req: Request) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { title = '', mediaUrl, clipCount, platforms, orientations, captionStyle } = body;
    const transcript: string = body.transcript || body.transcriptText || '';
    const config = {
      platforms: Array.isArray(platforms) && platforms.length ? platforms : undefined,
      orientations: Array.isArray(orientations) && orientations.length ? orientations : undefined,
      captionStyle,
    };
    const desiredClipCount = Math.min(10, Math.max(3, Number(clipCount) || 5));

    if (mediaUrl) {
      if (typeof mediaUrl !== 'string' || !isBlobUrl(mediaUrl)) {
        return NextResponse.json({ success: false, error: 'Invalid upload URL.' }, { status: 400 });
      }
      const result = await RepurposingService.ingestUpload(mediaUrl, String(title), desiredClipCount, config);
      return NextResponse.json({
        success: true,
        transcribing: true,
        project: result.project,
        message: `Uploaded "${result.project.title}" — transcribing the audio now (can take a few minutes for longer videos)…`,
      });
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
      desiredClipCount,
      ...config,
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
      { success: false, error: describeLlmError(error) },
      { status: 500 }
    );
  }
}
