import { prisma } from '../lib/prisma';
import { getLlmClient } from '../lib/llm';

export interface GoogleTrend {
  title: string;
  /** Google's own bucketed estimate, e.g. "20000+". */
  traffic: string;
  trafficEstimate: number;
  newsTitle?: string;
  newsUrl?: string;
  publishedAt?: string;
}

const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();

const tag = (xml: string, name: string) => {
  const m = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return m ? decode(m[1]) : undefined;
};

/** Parses Google Trends' "trending now" RSS feed into structured items. */
export function parseTrendsRss(xml: string): GoogleTrend[] {
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  return items
    .map((item) => {
      const title = tag(item, 'title') || '';
      const traffic = tag(item, 'ht:approx_traffic') || '';
      return {
        title,
        traffic,
        trafficEstimate: Number(traffic.replace(/[^\d]/g, '')) || 0,
        newsTitle: tag(item, 'ht:news_item_title'),
        newsUrl: tag(item, 'ht:news_item_url'),
        publishedAt: tag(item, 'pubDate'),
      };
    })
    .filter((t) => t.title);
}

export async function fetchGoogleTrends(geo = 'US'): Promise<GoogleTrend[]> {
  const region = /^[A-Z]{2}$/.test(geo) ? geo : 'US';
  const res = await fetch(`https://trends.google.com/trending/rss?geo=${region}`, {
    signal: AbortSignal.timeout(10000),
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Viralis/1.0)' },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Google Trends is unavailable right now (HTTP ${res.status}). Try again shortly.`);
  return parseTrendsRss(await res.text());
}

export interface RefreshResult {
  saved: number;
  scored: boolean;
  note?: string;
}

/**
 * Pulls today's real search trends and records them in the Trend Radar,
 * scored for fit with the workspace niche. Scoring is best-effort: if the AI
 * provider is unavailable the raw trends are still saved (scored by search
 * volume) rather than the whole refresh failing.
 */
export async function refreshTrendRadar(workspaceId: string, opts: { geo?: string } = {}): Promise<RefreshResult> {
  const trends = (await fetchGoogleTrends(opts.geo)).slice(0, 15);
  if (trends.length === 0) return { saved: 0, scored: false, note: 'Google Trends returned no topics for this region.' };

  const settings = await prisma.settings.findUnique({ where: { workspaceId } });
  const niche = settings?.brandNiche || 'general audience';

  type Scored = { index: number; score: number; viable: boolean; angle: string; keywords: string[] };
  let scored: Scored[] = [];
  let note: string | undefined;
  try {
    const { client, model } = await getLlmClient();
    const res = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'user',
          content: `Workspace niche: "${niche}".
Today's trending searches:
${trends.map((t, i) => `${i}. ${t.title} (${t.traffic} searches)${t.newsTitle ? ` — headline: ${t.newsTitle}` : ''}`).join('\n')}

For each, rate how well a creator in this niche could make a short video about it (0-100), whether it's worth doing, a one-sentence angle, and up to 5 keywords.
Return JSON: {"trends":[{"index":number,"score":number,"viable":boolean,"angle":string,"keywords":string[]}]}`,
        },
      ],
      temperature: 0.4,
      response_format: { type: 'json_object' },
    });
    const parsed = JSON.parse(res.choices[0]?.message?.content || '{}');
    scored = Array.isArray(parsed.trends) ? parsed.trends : [];
  } catch (err) {
    const { describeLlmError } = await import('../lib/llm');
    note = `Saved the raw trends, but niche scoring failed: ${describeLlmError(err)}`;
  }

  const maxTraffic = Math.max(...trends.map((t) => t.trafficEstimate), 1);
  const byIndex = new Map(scored.map((s) => [Number(s.index), s]));
  const rows = trends.map((t, i) => {
    const s = byIndex.get(i);
    return {
      workspaceId,
      topic: t.title.slice(0, 200),
      score: s ? Math.max(0, Math.min(100, Math.round(Number(s.score) || 0))) : Math.round((t.trafficEstimate / maxTraffic) * 100),
      keywords: JSON.stringify(Array.isArray(s?.keywords) ? s!.keywords.slice(0, 5) : [t.title]),
      isViable: s ? s.viable !== false : true,
      analysis: [s?.angle, `${t.traffic || 'Unknown'} searches`, t.newsTitle ? `In the news: ${t.newsTitle}` : '']
        .filter(Boolean)
        .join(' · ')
        .slice(0, 1000),
    };
  });

  await prisma.trend.createMany({ data: rows });
  return { saved: rows.length, scored: scored.length > 0, note };
}
