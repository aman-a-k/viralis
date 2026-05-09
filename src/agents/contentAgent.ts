import { BaseAgent, AgentResponse } from './base';
import { ContentGenerator } from '../services/contentGenerator';

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
      
      I have a generated script and visual prompts for a video about "${trendData.topic}".
      
      Script: ${baseContent.script}
      
      Visual Prompts: ${JSON.stringify(baseContent.visualPrompts)}
      
      Optimize this script for high retention. Add a powerful hook at the beginning and a clear call to action at the end. 
      Ensure the tone matches a viral social media post.
      
      Return the polished content in JSON format:
      {
        "polishedScript": "string",
        "hook": "string",
        "cta": "string",
        "refinedVisualPrompts": ["string"],
        "hashtags": ["string"]
      }
      `;
      
      const aiResponse = await this.chat(optimizationPrompt);
      const cleanedResponse = aiResponse.replace(/```json/g, '').replace(/```/g, '').trim();
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
