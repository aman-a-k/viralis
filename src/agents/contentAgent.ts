import { BaseAgent, AgentResponse } from './base';
import { ContentGenerator } from '../services/contentGenerator';
import { prisma } from '../lib/prisma';
import type { GeneratedContent } from '../types';

export interface PolishedScript {
  polishedScript: string;
  hook: string;
  cta: string;
  title: string;
  description: string;
  tags: string[];
  refinedScenes: { spokenText: string; bRollPrompt: string; durationEstimate: number }[];
}

export class ContentAgent extends BaseAgent {
  constructor() {
    super('CreativeContent', 'a viral content strategist and short-form scriptwriter');
  }

  async run(trendData: { topic: string; keywords: string[]; score?: number; workspaceId: string }): Promise<AgentResponse<{ original: GeneratedContent & { topic: string }; polished: PolishedScript }>> {
    this.log(`Writing content for: ${trendData.topic}`);
    try {
      const settings = await prisma.settings.findUnique({ where: { workspaceId: trendData.workspaceId } });
      const base = await ContentGenerator.generateVideoContent(
        { topic: trendData.topic, keywords: trendData.keywords, score: trendData.score ?? 80 },
        trendData.workspaceId
      );

      const polished = await this.chatJSON<PolishedScript>(
        `Brand tone: ${settings?.brandTone || 'clear and engaging'} · Audience: ${settings?.targetAudience || 'general'}.

Tighten this script for retention — stronger 3-second hook, clear CTA, keep the scene structure.
Script: ${base.script}
Scenes: ${JSON.stringify(base.scenes || [])}

Return JSON: {"polishedScript": string, "hook": string, "cta": string, "title": "<60 chars", "description": string, "tags": string[], "refinedScenes": [{"spokenText": string, "bRollPrompt": string, "durationEstimate": number}]}`
      );

      return {
        success: true,
        message: 'Script written and optimized.',
        data: { original: { ...base, topic: trendData.topic }, polished },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.log(`Error: ${message}`);
      return { success: false, message: 'Failed to generate content.', error: message };
    }
  }
}
