import { requireWorkspace, getOwnedClip } from '@/lib/workspace';
import { errorResponse } from '@/lib/http';
import { buildCues, cueOptionsForStyle, type CaptionCue } from '@/lib/captions';
import { clipWords } from '@/services/pipeline';

type Params = { params: Promise<{ clipId: string }> };

const ts = (s: number, sep: ',' | '.') => {
  const ms = Math.round(s * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  const rem = ms % 1000;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}${sep}${String(rem).padStart(3, '0')}`;
};

const toSrt = (cues: CaptionCue[]) => cues.map((c, i) => `${i + 1}\n${ts(c.start, ',')} --> ${ts(c.end, ',')}\n${c.text}\n`).join('\n');
const toVtt = (cues: CaptionCue[]) => `WEBVTT\n\n${cues.map((c) => `${ts(c.start, '.')} --> ${ts(c.end, '.')}\n${c.text}\n`).join('\n')}`;

/** Caption file for the clip (?format=srt|vtt), timed relative to the clip start. */
export async function GET(req: Request, { params }: Params) {
  try {
    const ctx = await requireWorkspace();
    const { clipId } = await params;
    const clip = await getOwnedClip(ctx.workspaceId, clipId);
    const format = new URL(req.url).searchParams.get('format') === 'vtt' ? 'vtt' : 'srt';
    const cues = buildCues(clipWords(clip, clip.project), clip.startTime, clip.endTime, cueOptionsForStyle('Minimalist'));
    const body = format === 'vtt' ? toVtt(cues) : toSrt(cues);
    const name = (clip.title.replace(/[^\p{L}\p{N} _-]+/gu, '').trim().slice(0, 60) || 'clip').replace(/\s+/g, '-');
    return new Response(body, {
      headers: {
        'Content-Type': format === 'vtt' ? 'text/vtt; charset=utf-8' : 'application/x-subrip; charset=utf-8',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(name)}.${format}"; filename*=UTF-8''${encodeURIComponent(name)}.${format}`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    return errorResponse(error, 'Could not build captions.', 'api/clips/captions');
  }
}
