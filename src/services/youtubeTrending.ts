import { prisma } from '../lib/prisma';

export type VideoVibe = 'hook' | 'calm' | 'trendy' | 'story';

export const VIBE_LABEL: Record<VideoVibe, string> = {
  hook: 'Hook-heavy',
  calm: 'Calm & informative',
  trendy: 'Trendy & fast',
  story: 'Story-driven',
};

export interface TrendingVideo {
  videoId: string;
  url: string;
  title: string;
  channelTitle: string;
  thumbnail: string | null;
  viewCount: number;
  likeCount: number;
  durationSeconds: number;
  publishedAt: string;
  categoryId: string;
  vibe: VideoVibe;
}

export class MissingYouTubeKeyError extends Error {
  constructor() {
    super(
      'No YouTube Data API key configured. Add one in Settings (free — console.cloud.google.com/apis/credentials, enable "YouTube Data API v3").'
    );
    this.name = 'MissingYouTubeKeyError';
  }
}

/** Curated categories worth exposing in the picker (id -> label). */
export const TRENDING_CATEGORIES: Record<string, string> = {
  '': 'All',
  '10': 'Music',
  '20': 'Gaming',
  '17': 'Sports',
  '24': 'Entertainment',
  '23': 'Comedy',
  '25': 'News & Politics',
  '26': 'Howto & Style',
  '27': 'Education',
  '28': 'Science & Tech',
  '22': 'People & Blogs',
};

function parseIsoDuration(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  const [, h, min, s] = m;
  return (Number(h) || 0) * 3600 + (Number(min) || 0) * 60 + (Number(s) || 0);
}

async function getApiKey(): Promise<string | null> {
  const settings = await prisma.settings.findFirst({ where: { id: 'default' } });
  return settings?.youtubeDataApiKey || process.env.YOUTUBE_API_KEY || null;
}

/** Real trending videos from the YouTube Data API (chart=mostPopular). */
export async function fetchTrendingVideos(opts: {
  regionCode?: string;
  categoryId?: string;
  maxResults?: number;
} = {}): Promise<TrendingVideo[]> {
  const apiKey = await getApiKey();
  if (!apiKey) throw new MissingYouTubeKeyError();

  const params = new URLSearchParams({
    part: 'snippet,contentDetails,statistics',
    chart: 'mostPopular',
    regionCode: opts.regionCode || 'US',
    maxResults: String(Math.min(30, Math.max(1, opts.maxResults || 15))),
    key: apiKey,
  });
  if (opts.categoryId) params.set('videoCategoryId', opts.categoryId);

  const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`, {
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const reason = body?.error?.message || `HTTP ${res.status}`;
    if (res.status === 403) throw new Error(`YouTube API rejected the key: ${reason}`);
    throw new Error(`YouTube API error: ${reason}`);
  }

  const data = await res.json();
  const items: any[] = data.items || [];

  return items.map((v) => {
    const title: string = v.snippet?.title || 'Untitled';
    const categoryId: string = v.snippet?.categoryId || '';
    const durationSeconds = parseIsoDuration(v.contentDetails?.duration || 'PT0S');
    return {
      videoId: v.id,
      url: `https://www.youtube.com/watch?v=${v.id}`,
      title,
      channelTitle: v.snippet?.channelTitle || 'Unknown channel',
      thumbnail: v.snippet?.thumbnails?.medium?.url || v.snippet?.thumbnails?.default?.url || null,
      viewCount: Number(v.statistics?.viewCount || 0),
      likeCount: Number(v.statistics?.likeCount || 0),
      durationSeconds,
      publishedAt: v.snippet?.publishedAt || '',
      categoryId,
      vibe: classifyVibe(title, categoryId, durationSeconds),
    };
  });
}

/**
 * Fast, free, no-LLM guess at a video's "vibe" so creators can filter by feel
 * instead of raw metadata. Good enough for a first pass; never blocks on
 * quota or latency.
 */
function classifyVibe(title: string, categoryId: string, durationSeconds: number): VideoVibe {
  const t = title.toLowerCase();
  const hookWords = ['you won\'t believe', 'shocking', 'secret', 'never', 'stop', 'nobody', 'truth', 'exposed', 'this is why', 'why i', '?', '!'];
  const storyWords = ['story', 'happened', 'i tried', 'my experience', 'day in', 'vlog', 'journey', 'react'];

  if (durationSeconds < 90) return 'trendy'; // shorts/clips, regardless of category
  if (hookWords.some((w) => t.includes(w))) return 'hook';
  if (['25', '23'].includes(categoryId) && durationSeconds < 240) return 'trendy'; // News/Comedy shorts
  if (['10', '20'].includes(categoryId) && durationSeconds < 600) return 'trendy'; // short Music/Gaming clips
  if (storyWords.some((w) => t.includes(w)) || ['22', '24', '20'].includes(categoryId)) return 'story'; // Vlogs/Entertainment/Gaming
  if (['27', '28', '26'].includes(categoryId) || durationSeconds > 1800) return 'calm'; // Education/Science/Howto or long-form talking content
  return 'story';
}

/** Picks the single best trending video for a niche using the workspace LLM. */
export async function pickBestForNiche(videos: TrendingVideo[], niche: string): Promise<TrendingVideo> {
  if (videos.length === 0) throw new Error('No trending videos to choose from.');
  if (videos.length === 1) return videos[0];

  try {
    const { getLlmClient } = await import('../lib/llm');
    const { client, model } = await getLlmClient();
    const list = videos
      .slice(0, 15)
      .map((v, i) => `${i}. "${v.title}" — ${v.channelTitle} (${v.viewCount.toLocaleString()} views, ${Math.round(v.durationSeconds / 60)} min)`)
      .join('\n');

    const res = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'user',
          content: `Workspace niche: "${niche}".\nTrending videos:\n${list}\n\nPick the index of the ONE video most likely to have strong, extractable short-form moments for this niche (prefer talking-head / long-form spoken content over music videos or pure highlight reels). Return JSON: {"index": number}`,
        },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });
    const parsed = JSON.parse(res.choices[0]?.message?.content || '{}');
    const idx = Number(parsed.index);
    if (Number.isInteger(idx) && videos[idx]) return videos[idx];
  } catch {
    /* fall through to heuristic */
  }

  // Heuristic fallback: most-viewed video under 40 minutes (likely to have real spoken content)
  const candidates = videos.filter((v) => v.durationSeconds > 60 && v.durationSeconds < 2400);
  return (candidates[0] || videos[0]);
}
