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
      // 1. Use AI to optimize/validate metadata for the specific platform
      const metadataPrompt = `
      I have a video ready for publishing.
      Topic: ${content.original.topic}
      Pre-generated Title: ${content.polished?.title || 'None'}
      Pre-generated Description: ${content.polished?.description || 'None'}
      Pre-generated Tags: ${JSON.stringify(content.polished?.tags || [])}
      
      Your job as a master growth hacker is to analyze the pre-generated metadata. If it is missing or weak, you MUST generate highly engaging, CTR-optimized metadata.
      The Title should be under 60 characters and create intense curiosity.
      The Description MUST include the tags as hashtags at the bottom (e.g., #trending #viral).
      
      Return JSON:
      {
        "title": "Final Viral Title",
        "description": "Final SEO Description with Hashtags",
        "tags": ["string"],
        "platforms": ["YouTube", "Instagram"]
      }
      `;
      
      const aiResponse = await this.chat(metadataPrompt, "gpt-4o");
      const responseText = aiResponse.content || "{}";
      const cleanedResponse = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      const metadata = JSON.parse(cleanedResponse);
      
      // 2. Perform the publishing
      const success = await Publisher.publishVideo(videoPath, metadata.title, metadata.description, metadata.tags);
      
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
