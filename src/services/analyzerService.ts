import type { PlatformCaptions } from '../types';
import { getLlmClient, MissingApiKeyError } from '../lib/llm';
import {
  type YouTubeVideoData,
  transcriptToPromptText,
  transcriptSlice,
  formatTimestamp,
} from './youtubeService';

export { MissingApiKeyError };

export interface AnalyzedClip {
  title: string;
  startTime: number;
  endTime: number;
  viralityScore: number;
  reasoning: string;
  hookType: string;
  transcriptSegment: string;
  captions: PlatformCaptions;
}

const EMPTY_CAPTIONS: PlatformCaptions = {
  instagram: '',
  youtube: '',
  linkedin: '',
  twitter: '',
  tiktok: '',
};

function clampClip(raw: any, duration: number): AnalyzedClip | null {
  let start = Number(raw?.startTime ?? raw?.start ?? NaN);
  let end = Number(raw?.endTime ?? raw?.end ?? NaN);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;

  start = Math.max(0, Math.min(start, duration - 5));
  end = Math.max(start + 8, Math.min(end, duration));
  // keep clips in a shareable 12–75s range
  if (end - start > 75) end = start + 75;
  if (end - start < 12) end = Math.min(duration, start + 20);

  const score = Math.max(1, Math.min(100, Math.round(Number(raw?.viralityScore ?? raw?.score ?? 70))));
  const caps = raw?.captions ?? {};

  return {
    title: String(raw?.title || 'Untitled highlight').slice(0, 120),
    startTime: Math.round(start * 10) / 10,
    endTime: Math.round(end * 10) / 10,
    viralityScore: score,
    reasoning: String(raw?.reasoning || raw?.reason || '').slice(0, 600),
    hookType: String(raw?.hookType || raw?.hook || 'insight').slice(0, 40),
    transcriptSegment: '',
    captions: {
      instagram: String(caps.instagram || '').slice(0, 2200),
      youtube: String(caps.youtube || '').slice(0, 900),
      linkedin: String(caps.linkedin || '').slice(0, 2200),
      twitter: String(caps.twitter || caps.x || '').slice(0, 400),
      tiktok: String(caps.tiktok || '').slice(0, 500),
    },
  };
}

export interface AnalyzeOptions {
  /** Which platforms to write captions for. Defaults to all five. */
  platforms?: string[];
  /** "Dynamic Pop" (punchy, emoji, Hormozi-style) or "Minimalist" (clean, few/no emoji). */
  captionStyle?: string;
}

const ALL_PLATFORMS = ['instagram', 'youtube', 'linkedin', 'twitter', 'tiktok'];

/**
 * Runs real highlight detection over a real transcript.
 * Timestamps are clamped to the video and the transcript segment is
 * recomputed from the actual caption text (never trusted from the model).
 */
export async function analyzeTranscript(
  video: YouTubeVideoData,
  desiredCount = 5,
  options: AnalyzeOptions = {}
): Promise<AnalyzedClip[]> {
  const { client, model } = await getLlmClient();
  const transcriptText = transcriptToPromptText(video.transcript, 13000);

  const platforms = (options.platforms?.length ? options.platforms : ALL_PLATFORMS).filter((p) =>
    ALL_PLATFORMS.includes(p)
  );
  const captionStyle = options.captionStyle === 'Minimalist' ? 'Minimalist' : 'Dynamic Pop';
  const toneNote =
    captionStyle === 'Minimalist'
      ? 'Keep captions clean and minimal — short sentences, little to no emoji, no hashtag spam (0-3 relevant tags max).'
      : 'Keep captions punchy and high-energy — pattern interrupts, tasteful emoji, a hook line first, hashtags where the platform expects them.';

  const system =
    'You are Viralis, an expert short-form video editor. You find the moments in a long-form ' +
    'video that will perform best as standalone vertical clips, and write native copy for each platform. ' +
    'You only use timestamps that exist in the transcript. Respond with strict JSON.';

  const user = `VIDEO: "${video.title}" by ${video.author} (${formatTimestamp(video.durationSeconds)} long)

TRANSCRIPT (timestamps in mm:ss or h:mm:ss):
"""
${transcriptText}
"""

Find the ${desiredCount} strongest standalone clips (each 15–60 seconds). For each, return:
- title: a scroll-stopping title for the clip
- startTime / endTime: seconds (integers) within the video, matching real transcript moments
- viralityScore: 1–100, how likely this clip is to over-perform
- hookType: one of "contrarian", "framework", "story", "data", "question", "howto", "controversy"
- reasoning: 1–2 sentences on why this moment works (be specific about the hook)
- captions: object with keys ${platforms.join(', ')} — each a ready-to-post caption written natively for that platform. ${toneNote}

Return JSON exactly: { "clips": [ { ... } ] }  — ordered by viralityScore descending.`;

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.6,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content || '{}';
  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch {
    // some models wrap JSON in prose or fences
    const m = content.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('The analysis model returned malformed output. Try again.');
    parsed = JSON.parse(m[0]);
  }

  const rawClips: any[] = Array.isArray(parsed) ? parsed : parsed.clips || parsed.highlights || [];
  const clips = rawClips
    .map((c) => clampClip(c, video.durationSeconds))
    .filter((c): c is AnalyzedClip => c !== null)
    .map((c) => {
      const seg = transcriptSlice(video.transcript, c.startTime, c.endTime);
      c.transcriptSegment = seg || c.title;
      // fall back to a plain caption if the model skipped one
      if (!c.captions.instagram && !c.captions.youtube) {
        c.captions = { ...EMPTY_CAPTIONS, instagram: c.title, youtube: c.title };
      }
      return c;
    })
    .sort((a, b) => b.viralityScore - a.viralityScore);

  if (clips.length === 0) {
    throw new Error('No usable highlights were found in this transcript.');
  }
  return clips;
}
