import { TrendData } from '../types';
import { getLlmClient } from '../lib/llm';
import { prisma } from '../lib/prisma';

export class TrendAnalyzer {
  /**
   * Finds a trending topic for short-form video. Tries Google Trends first
   * (best effort — the unofficial API is frequently blocked), then falls back
   * to an LLM pass grounded in the workspace's niche.
   */
  static async getDailyTrend(): Promise<TrendData> {
    const settings = await prisma.settings.findFirst({ where: { id: 'default' } });
    const niche = settings?.brandNiche || 'technology and internet culture';
    const audience = settings?.targetAudience || 'a general social media audience';

    // 1. Best-effort real trend from Google Trends RSS (no key, often works)
    try {
      const res = await fetch('https://trends.google.com/trending/rss?geo=US', {
        signal: AbortSignal.timeout(8000),
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      if (res.ok) {
        const xml = await res.text();
        const titles = [...xml.matchAll(/<title>(?:<!\[CDATA\[)?([^<\]]+)(?:\]\]>)?<\/title>/g)]
          .map((m) => m[1].trim())
          .filter((t) => t && t !== 'Daily Search Trends' && t.length < 60);
        if (titles.length > 3) {
          const picked = await this.pickRelevant(titles.slice(0, 20), niche, audience);
          if (picked) return picked;
        }
      }
    } catch {
      /* fall through */
    }

    // 2. LLM-generated trend grounded in the niche
    const { client, model } = await getLlmClient();
    const res = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'user',
          content: `Suggest ONE topic that is genuinely trending right now and would make a strong short-form video for ${audience} in the "${niche}" space. Return JSON: {"topic": string, "score": number (est. search interest 1-100), "keywords": string[5], "whyNow": string}`,
        },
      ],
      temperature: 0.8,
      response_format: { type: 'json_object' },
    });
    const data = JSON.parse(res.choices[0]?.message?.content || '{}');
    return {
      topic: data.topic || 'The state of AI in everyday life',
      score: Math.min(100, Math.max(1, Number(data.score) || 80)),
      keywords: Array.isArray(data.keywords) ? data.keywords.slice(0, 5) : ['trending', 'viral', 'news'],
    };
  }

  private static async pickRelevant(
    candidates: string[],
    niche: string,
    audience: string
  ): Promise<TrendData | null> {
    try {
      const { client, model } = await getLlmClient();
      const res = await client.chat.completions.create({
        model,
        messages: [
          {
            role: 'user',
            content: `Trending searches today: ${candidates.join(', ')}.
Pick the single best one for a short-form video aimed at ${audience} in "${niche}". Return JSON: {"topic": string, "score": number 1-100, "keywords": string[5]}`,
          },
        ],
        temperature: 0.5,
        response_format: { type: 'json_object' },
      });
      const d = JSON.parse(res.choices[0]?.message?.content || '{}');
      if (!d.topic) return null;
      return {
        topic: d.topic,
        score: Math.min(100, Math.max(1, Number(d.score) || 75)),
        keywords: Array.isArray(d.keywords) ? d.keywords.slice(0, 5) : [d.topic],
      };
    } catch {
      return null;
    }
  }
}
