import { BaseAgent, AgentResponse } from './base';
import { Publisher } from '../services/publisher';

export class PublisherAgent extends BaseAgent {
  constructor() {
    super('StrategicPublishing', 'a social media growth hacker and distribution specialist');
  }

  async run(input: { videoPath: string, content: any }): Promise<AgentResponse> {
    const { videoPath, content } = input;
    this.log(`Planning distribution for video: ${videoPath}`);
    
    try {
      // 1. Use AI to optimize metadata for the specific platform
      const metadataPrompt = `
      I have a video ready for publishing.
      Topic: ${content.original.topic}
      Hook: ${content.polished?.hook}
      CTA: ${content.polished?.cta}
      
      Suggest a viral title and a SEO-optimized description for YouTube Shorts and Instagram Reels.
      Also, suggest the best time to post this (assume UTC).
      
      Return JSON:
      {
        "title": "string",
        "description": "string",
        "tags": ["string"],
        "recommendedTime": "string",
        "platforms": ["YouTube", "Instagram"]
      }
      `;
      
      const aiResponse = await this.chat(metadataPrompt);
      const cleanedResponse = aiResponse.replace(/```json/g, '').replace(/```/g, '').trim();
      const metadata = JSON.parse(cleanedResponse);
      
      // 2. Perform the publishing
      const success = await Publisher.publishVideo(videoPath, metadata.title, metadata.description);
      
      return {
        success,
        message: success ? 'Content published successfully.' : 'Publishing failed.',
        data: {
          metadata,
          publishedAt: new Date().toISOString()
        }
      };
    } catch (error: any) {
      this.log(`Error in PublisherAgent: ${error.message}`);
      return {
        success: false,
        message: 'Failed to publish content.',
        error: error.message
      };
    }
  }
}
