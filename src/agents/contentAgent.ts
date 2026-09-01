import { BaseAgent, AgentResponse } from './base';
import { ContentGenerator } from '../services/contentGenerator';
import { prisma } from '../lib/prisma';

export class ContentAgent extends BaseAgent {
  constructor() {
    super('CreativeContent', 'a viral content strategist and award-winning scriptwriter');
  }

  async run(trendData: any): Promise<AgentResponse> {
    this.log(`Crafting content for topic: ${trendData.topic}`);
    
    try {
      // 1. Fetch Brand Settings
      const settings = await prisma.settings.findFirst({ where: { id: 'default' } });
      const brandContext = `
        Brand Name: ${settings?.brandName || 'Automator AI'}
        Niche: ${settings?.brandNiche || 'General'}
        Tone: ${settings?.brandTone || 'Professional'}
        Target Audience: ${settings?.targetAudience || 'General Audience'}
      `;

      // 2. Use the existing service to generate the base content
      const baseContent = await ContentGenerator.generateVideoContent(trendData);
      
      // 3. Use AI to polish and optimize for high retention
      const optimizationPrompt = `
      Brand Context: ${brandContext}
      
      I have a generated script and scenes for a video about "${trendData.topic}".
      
      Script: ${baseContent.script}
      Scenes: ${JSON.stringify(baseContent.scenes)}
      
      Optimize this script for high retention. Add a powerful hook at the beginning and a clear call to action at the end. 
      Ensure the tone matches a viral social media post.
      You MUST return the polished content in JSON format, keeping the scene structure intact but improving the spokenText and bRollPrompts.
      
      {
        "polishedScript": "string",
        "hook": "string",
        "cta": "string",
        "refinedScenes": [
          {
            "spokenText": "string",
            "bRollPrompt": "string",
            "durationEstimate": number
          }
        ],
        "title": "A highly clickable, click-through-rate optimized title (under 60 chars)",
        "description": "An engaging description including the CTA and a summary.",
        "tags": ["trending", "viral", "nicheSpecificTag"]
      }
      `;
      
      const aiResponse = await this.chat(optimizationPrompt, "gpt-4o");
      // Note: base class chat method now returns the message object directly because we updated it for tool calling
      const responseText = aiResponse.content || "{}";
      const cleanedResponse = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      const polishedContent = JSON.parse(cleanedResponse);
      
      return {
        success: true,
        message: 'Content creation and optimization completed.',
        data: {
          original: baseContent,
          polished: polishedContent
        }
      };
    } catch (error: any) {
      this.log(`Error in ContentAgent: ${error.message}`);
      return {
        success: false,
        message: 'Failed to generate content.',
        error: error.message
      };
    }
  }
}
