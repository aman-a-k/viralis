import type { PlatformCaptions } from '../types';
import { getLlmClient, MissingApiKeyError } from '../lib/llm';
import { formatTimestamp } from './youtubeService';
import { segmentsToWords, wordsInRange, wordsToText, type TranscriptSegment } from '../lib/captions';

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

export interface AnalyzeOptions {
  /** Which platforms to write captions for. Defaults to all five. */
  platforms?: string[];
  /** "Dynamic Pop" (punchy, emoji) or "Minimalist" (clean, few/no emoji). */
  captionStyle?: string;
  /** Spoken language, if known — captions/copy are written in it. */
  language?: string;
  /** Learning-loop guidance from this workspace's published results. */
  performanceNotes?: string;
  brand?: { name?: string | null; niche?: string | null; tone?: string | null; audience?: string | null };
}

export interface VideoMeta {
  title: string;
  author: string;
  durationSeconds: number;
}

const ALL_PLATFORMS = ['instagram', 'youtube', 'linkedin', 'twitter', 'tiktok'];

const EMPTY_CAPTIONS: PlatformCaptions = { instagram: '', youtube: '', linkedin: '', twitter: '', tiktok: '' };

// ~9k characters keeps each request well inside free-tier context and output
// limits while giving the model enough surrounding context to judge a moment.
export const CHUNK_CHARS = 9000;
const CHUNK_OVERLAP_SECONDS = 45;

export interface TranscriptChunk {
  index: number;
  start: number;
  end: number;
  text: string;
}

/**
 * Splits the whole transcript into overlapping windows so every part of a
 * long recording is analyzed (previously only the first ~13k characters
 * ever reached the model). The overlap keeps a strong moment that straddles
 * a boundary from being cut in half.
 */
export function chunkTranscript(segments: TranscriptSegment[], maxChars = CHUNK_CHARS): TranscriptChunk[] {
  const chunks: TranscriptChunk[] = [];
  let i = 0;
  while (i < segments.length) {
    const lines: string[] = [];
    let chars = 0;
    let j = i;
    while (j < segments.length) {
      const line = `[${formatTimestamp(segments[j].start)}] ${segments[j].text}`;
      if (chars + line.length > maxChars && lines.length) break;
      lines.push(line);
      chars += line.length + 1;
      j++;
    }
    chunks.push({ index: chunks.length, start: segments[i].start, end: segments[j - 1].end, text: lines.join('\n') });
    if (j >= segments.length) break;
    // Step back so the next chunk re-reads the tail of this one.
    const overlapFrom = segments[j - 1].end - CHUNK_OVERLAP_SECONDS;
    let k = j - 1;
    while (k > i + 1 && segments[k - 1].start >= overlapFrom) k--;
    i = Math.max(i + 1, k);
  }
  return chunks;
}

interface RawClip {
  title?: unknown;
  startTime?: unknown;
  endTime?: unknown;
  start?: unknown;
  end?: unknown;
  viralityScore?: unknown;
  score?: unknown;
  reasoning?: unknown;
  reason?: unknown;
  hookType?: unknown;
  hook?: unknown;
  captions?: Record<string, unknown>;
}

function clampClip(raw: RawClip, duration: number): AnalyzedClip | null {
  let start = Number(raw?.startTime ?? raw?.start ?? NaN);
  let end = Number(raw?.endTime ?? raw?.end ?? NaN);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;

  start = Math.max(0, Math.min(start, Math.max(0, duration - 5)));
  end = Math.max(start + 8, Math.min(end, duration));
  if (end - start > 75) end = start + 75;
  if (end - start < 12) end = Math.min(duration, start + 20);
  if (end <= start) return null;

  const caps = raw?.captions ?? {};
  return {
    title: String(raw?.title || 'Untitled highlight').slice(0, 120),
    startTime: Math.round(start * 10) / 10,
    endTime: Math.round(end * 10) / 10,
    viralityScore: Math.max(1, Math.min(100, Math.round(Number(raw?.viralityScore ?? raw?.score ?? 70)))),
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

function parseJsonLoose(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    const m = content.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('The analysis model returned malformed output. Try again.');
    return JSON.parse(m[0]);
  }
}

/** Finds candidate clips inside one transcript window. */
export async function analyzeChunk(
  meta: VideoMeta,
  chunk: TranscriptChunk,
  candidateCount: number,
  options: AnalyzeOptions = {}
): Promise<AnalyzedClip[]> {
  const { client, model } = await getLlmClient();
  const platforms = (options.platforms?.length ? options.platforms : ALL_PLATFORMS).filter((p) => ALL_PLATFORMS.includes(p));
  const toneNote =
    options.captionStyle === 'Minimalist'
      ? 'Keep captions clean and minimal — short sentences, little to no emoji, 0-3 relevant hashtags.'
      : 'Keep captions punchy — a hook line first, tasteful emoji, hashtags where the platform expects them.';
  const lang =
    options.language && options.language !== 'auto'
      ? `Write titles and captions in the recording's language (${options.language}).`
      : "Write titles and captions in the same language the speaker uses.";
  const brand = options.brand
    ? [
        options.brand.name && `Creator/brand: ${options.brand.name}`,
        options.brand.niche && `Niche: ${options.brand.niche}`,
        options.brand.tone && `Voice: ${options.brand.tone}`,
        options.brand.audience && `Audience: ${options.brand.audience}`,
      ]
        .filter(Boolean)
        .join('\n')
    : '';

  const system =
    'You are Viralis, an expert short-form video editor. You find the moments in a long recording that work ' +
    'as standalone vertical clips, and write native copy for each platform. A clip must make sense without the ' +
    'rest of the video: it starts at the beginning of a thought and ends after the point lands. Only use ' +
    'timestamps that appear in the transcript. Respond with strict JSON.';

  const user = `RECORDING: "${meta.title}" by ${meta.author} (${formatTimestamp(meta.durationSeconds)} long)
${brand ? `\n${brand}\n` : ''}${options.performanceNotes ? `\nWhat has worked for this creator so far: ${options.performanceNotes}\n` : ''}
TRANSCRIPT EXCERPT (${formatTimestamp(chunk.start)}–${formatTimestamp(chunk.end)}):
"""
${chunk.text}
"""

Find up to ${candidateCount} strong standalone clips (15–60 seconds each) in this excerpt. Skip filler, greetings and housekeeping. For each:
- title: a clear, specific title for the clip
- startTime / endTime: seconds within the recording, matching real transcript moments
- viralityScore: 1–100, your estimate of how well it will hold attention (an editorial judgment, not a prediction)
- hookType: one of "contrarian", "framework", "story", "data", "question", "howto", "controversy", "insight"
- reasoning: 1–2 sentences on why this moment works on its own
- captions: object with keys ${platforms.join(', ')} — each a ready-to-post caption written natively for that platform. ${toneNote}
${lang}

Return JSON exactly: { "clips": [ { ... } ] }`;

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.5,
    response_format: { type: 'json_object' },
  });
  const parsed = parseJsonLoose(response.choices[0]?.message?.content || '{}') as RawClip[] | { clips?: RawClip[]; highlights?: RawClip[] };
  const raw: RawClip[] = Array.isArray(parsed) ? parsed : parsed.clips || parsed.highlights || [];
  return raw
    .map((c) => clampClip(c, meta.durationSeconds))
    .filter((c): c is AnalyzedClip => c !== null)
    // Keep only clips anchored inside this window (the model occasionally
    // invents timestamps outside the excerpt it was shown).
    .filter((c) => c.startTime >= chunk.start - 5 && c.startTime <= chunk.end);
}

const overlapRatio = (a: AnalyzedClip, b: AnalyzedClip) => {
  const inter = Math.max(0, Math.min(a.endTime, b.endTime) - Math.max(a.startTime, b.startTime));
  return inter / Math.min(a.endTime - a.startTime, b.endTime - b.startTime);
};

/**
 * Merges candidates from every window: drop near-duplicates (the overlap
 * between windows yields the same moment twice), rank, keep the best N, and
 * fill in the exact transcript text from word timings.
 */
export function selectClips(
  candidates: AnalyzedClip[],
  segments: TranscriptSegment[],
  desiredCount: number
): AnalyzedClip[] {
  const sorted = [...candidates].sort((a, b) => b.viralityScore - a.viralityScore);
  const kept: AnalyzedClip[] = [];
  for (const c of sorted) {
    if (kept.some((k) => overlapRatio(k, c) > 0.4)) continue;
    kept.push(c);
    if (kept.length >= desiredCount) break;
  }
  const words = segmentsToWords(segments);
  return kept.map((c) => snapToSentences(c, segments)).map((c) => {
    const text = wordsToText(wordsInRange(words, c.startTime, c.endTime));
    const captions = !c.captions.instagram && !c.captions.youtube ? { ...EMPTY_CAPTIONS, instagram: c.title, youtube: c.title } : c.captions;
    return { ...c, transcriptSegment: text || c.title, captions };
  });
}

const SNAP_SECONDS = 4;

/**
 * Moves a clip's edges to sentence boundaries when one is close, so clips
 * start at the beginning of a thought and end after it — model timestamps
 * often land a few words into a sentence.
 */
export function snapToSentences(c: AnalyzedClip, segments: TranscriptSegment[]): AnalyzedClip {
  let start = c.startTime;
  let end = c.endTime;
  const inside = segments.find((s) => s.start <= start + 0.05 && s.end > start);
  if (inside && start - inside.start <= SNAP_SECONDS) start = inside.start;
  const closing = segments.find((s) => s.start < end && s.end >= end - 0.05);
  if (closing && closing.end - end <= SNAP_SECONDS) end = closing.end;
  if (end - start < 8 || end - start > 90) return c;
  return { ...c, startTime: Math.round(start * 10) / 10, endTime: Math.round(end * 10) / 10 };
}

/** How many candidates to ask each window for, so the merge has real choice. */
export function candidatesPerChunk(desiredCount: number, chunkCount: number) {
  return Math.min(8, Math.max(2, Math.ceil((desiredCount * 2) / Math.max(1, chunkCount))));
}
