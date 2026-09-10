import { TrendData, GeneratedContent } from '../types';
import { getLlmClient } from '../lib/llm';
import { prisma } from '../lib/prisma';

export class ContentGenerator {
  /**
   * Generates a short-form video script, scene list, visual prompts and
   * timed captions for a trending topic.
   */
  static async generateVideoContent(trend: TrendData): Promise<GeneratedContent> {
    const settings = await prisma.settings.findFirst({ where: { id: 'default' } });
    const { client, model } = await getLlmClient();

    const brand = [
      `Brand: ${settings?.brandName || 'Viralis'}`,
      `Niche: ${settings?.brandNiche || 'Technology & AI'}`,
      `Tone: ${settings?.brandTone || 'Punchy & Viral'}`,
      `Audience: ${settings?.targetAudience || 'Social media audience'}`,
    ].join('\n');

    const prompt = `${brand}

Write a 45–60 second vertical video about "${trend.topic}".
Keywords: ${trend.keywords.join(', ')}.

Return JSON exactly:
{
  "script": "the full voiceover, one flowing paragraph",
  "visualPrompts": ["stock-footage search query", ...],
  "captions": [{ "startTime": 0, "endTime": 2.5, "text": "on-screen words" }, ...],
  "scenes": [{ "spokenText": "sentence for this scene", "bRollPrompt": "detailed stock-footage query", "durationEstimate": 3.0 }, ...],
  "title": "a click-through-optimized title under 60 chars",
  "description": "engaging description with a CTA",
  "tags": ["tag", ...]
}
Break the script into 5–10 scenes; durationEstimate should sum to ~50s.`;

    const res = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    const raw = res.choices[0]?.message?.content || '{}';
    let parsed: GeneratedContent;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      if (!m) throw new Error('The content model returned malformed output.');
      parsed = JSON.parse(m[0]);
    }

    if (!parsed.script) throw new Error('The content model did not return a script.');
    parsed.captions = Array.isArray(parsed.captions) ? parsed.captions : [];
    parsed.visualPrompts = Array.isArray(parsed.visualPrompts) ? parsed.visualPrompts : [];
    return parsed;
  }
}
