import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';
import { describeLlmError, getLlmClient, MissingApiKeyError } from '@/lib/llm';

export const maxDuration = 60;

// Personas for the Agent Fleet cards (ids match /api/data's agents list).
const AGENTS: Record<string, { name: string; brief: string }> = {
  'clipper-agent': {
    name: 'Viralis Highlight AI',
    brief: 'You find the moments in long-form video that work as standalone short clips and explain what makes a strong hook.',
  },
  'reframe-agent': {
    name: 'Reframe & Caption Renderer',
    brief: 'You advise on vertical reframing, pacing, on-screen caption style and edit choices for short-form video.',
  },
  'copy-agent': {
    name: 'Platform Copywriter',
    brief: 'You write native captions, titles and hashtags for Instagram Reels, YouTube Shorts, TikTok, LinkedIn and X.',
  },
  'trend-agent': {
    name: 'Trend Radar',
    brief: 'You research short-form content trends and suggest timely topics and angles. You cannot browse the web, so say so when asked for live data.',
  },
  'feedback-agent': {
    name: 'Learning Loop',
    brief: 'You analyze short-form performance (watch-through, drop-off, hook style) and recommend what to change.',
  },
};

export async function POST(req: Request) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  try {
    const { agentId, prompt } = await req.json();
    const agent = AGENTS[agentId as string];
    if (!agent) {
      return NextResponse.json({ success: false, error: 'Unknown agent.' }, { status: 400 });
    }
    if (typeof prompt !== 'string' || !prompt.trim()) {
      return NextResponse.json({ success: false, error: 'Type an instruction first.' }, { status: 400 });
    }

    const settings = await prisma.settings.findFirst({ where: { id: 'default' } });
    const brand = [
      settings?.brandName && `Brand: ${settings.brandName}`,
      settings?.brandNiche && `Niche: ${settings.brandNiche}`,
      settings?.brandTone && `Tone: ${settings.brandTone}`,
      settings?.targetAudience && `Audience: ${settings.targetAudience}`,
    ]
      .filter(Boolean)
      .join('\n');

    const { client, model } = await getLlmClient();
    const res = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `You are ${agent.name}, part of the Viralis content team. ${agent.brief}\n${brand}\nBe concise and practical. Plain text, no markdown headings.`,
        },
        { role: 'user', content: prompt.trim().slice(0, 4000) },
      ],
      temperature: 0.7,
    });

    const reply = res.choices[0]?.message?.content?.trim();
    if (!reply) throw new Error('The agent returned an empty reply. Try again.');
    return NextResponse.json({ success: true, agent: agent.name, reply });
  } catch (error: unknown) {
    const status = error instanceof MissingApiKeyError ? 424 : 500;
    return NextResponse.json(
      { success: false, error: error instanceof MissingApiKeyError ? error.message : describeLlmError(error) },
      { status }
    );
  }
}
