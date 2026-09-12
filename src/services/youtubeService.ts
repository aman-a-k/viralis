import { YoutubeTranscript } from 'youtube-transcript';

export interface TranscriptSegment {
  text: string;
  start: number; // seconds
  end: number; // seconds
}

export interface YouTubeVideoData {
  videoId: string;
  url: string;
  title: string;
  author: string;
  description: string;
  durationSeconds: number;
  thumbnail: string | null;
  transcript: TranscriptSegment[];
  fullText: string;
  transcriptSource: 'captions' | 'description-only';
}

/** Extract the 11-char video id from any common YouTube URL form. */
export function extractVideoId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  const patterns = [
    /(?:youtube\.com\/watch\?(?:.*&)?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/(?:embed|shorts|live|v)\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = trimmed.match(p);
    if (m) return m[1];
  }
  return null;
}

export function isYouTubeUrl(input: string): boolean {
  return /youtube\.com|youtu\.be/.test(input || '');
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;#39;|&#39;/g, "'")
    .replace(/&amp;quot;|&quot;/g, '"')
    .replace(/&amp;amp;/g, '&')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

export interface YouTubeMetadata {
  videoId: string;
  url: string;
  title: string;
  author: string;
  thumbnail: string | null;
}

/**
 * Fetches just title/author/thumbnail via the public oEmbed endpoint — no
 * transcript, so it never fails due to missing captions. Used to create a
 * Project immediately while transcription runs as a background job.
 */
export async function fetchYouTubeMetadata(url: string): Promise<YouTubeMetadata> {
  const videoId = extractVideoId(url);
  if (!videoId) {
    throw new Error('Could not parse a YouTube video ID from that link.');
  }

  const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;
  let title = 'Untitled video';
  let author = 'Unknown';
  let thumbnail: string | null = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(canonicalUrl)}&format=json`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (res.ok) {
      const data = await res.json();
      title = data.title || title;
      author = data.author_name || author;
      if (data.thumbnail_url) thumbnail = data.thumbnail_url;
    } else if (res.status === 401 || res.status === 404) {
      throw new Error('That video is private, unavailable, or the link is wrong.');
    }
  } catch (err) {
    if (err instanceof Error && /private|unavailable|link is wrong/.test(err.message)) throw err;
    // metadata is best-effort; continue
  }

  return { videoId, url: canonicalUrl, title, author, thumbnail };
}

/**
 * Fetches real metadata + the real caption transcript for a YouTube video.
 * No video download — uses the public oEmbed endpoint plus the caption track.
 * Throws if no transcript is reachable this way (YouTube regularly blocks
 * this from cloud IPs) — callers should fall back to worker-based
 * transcription (see RepurposingService.ingestYouTube) when that happens.
 */
export async function fetchYouTubeVideo(url: string): Promise<YouTubeVideoData> {
  const { videoId, url: canonicalUrl, title, author, thumbnail } = await fetchYouTubeMetadata(url);

  // --- Real caption transcript (English-first) ---
  let transcript: TranscriptSegment[] = [];
  for (const opts of [{ lang: 'en' }, {}]) {
    try {
      const raw = await YoutubeTranscript.fetchTranscript(videoId, opts as Record<string, unknown>);
      const parsed = raw
        .map((r: { text: string; offset?: number; duration?: number }) => {
          const start = (r.offset ?? 0) / 1000;
          const dur = (r.duration ?? 0) / 1000;
          return {
            text: decodeEntities(String(r.text || '')).replace(/\s+/g, ' ').trim(),
            start,
            end: start + (dur || 3),
          };
        })
        .filter((s: TranscriptSegment) => s.text.length > 0 && s.text !== '[Music]');
      if (parsed.length) {
        transcript = parsed;
        break;
      }
    } catch {
      /* try next option set */
    }
  }

  if (transcript.length === 0) {
    throw new Error(
      'No captions available for this video. Viralis analyzes the transcript — pick a video with captions/subtitles enabled.'
    );
  }

  const durationSeconds = Math.ceil(transcript[transcript.length - 1].end);
  const fullText = transcript.map((s) => s.text).join(' ');

  return {
    videoId,
    url: canonicalUrl,
    title,
    author,
    description: '',
    durationSeconds,
    thumbnail,
    transcript,
    fullText,
    transcriptSource: 'captions',
  };
}

/** Compact a timestamped transcript into a token for the LLM prompt. */
export function transcriptToPromptText(transcript: TranscriptSegment[], maxChars = 12000): string {
  const lines: string[] = [];
  let total = 0;
  for (const seg of transcript) {
    const line = `[${formatTimestamp(seg.start)}] ${seg.text}`;
    if (total + line.length > maxChars) break;
    lines.push(line);
    total += line.length + 1;
  }
  return lines.join('\n');
}

export function formatTimestamp(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

/** Pull the transcript text that falls within a [start, end] window. */
export function transcriptSlice(transcript: TranscriptSegment[], start: number, end: number): string {
  return transcript
    .filter((s) => s.end > start && s.start < end)
    .map((s) => s.text)
    .join(' ')
    .trim();
}
