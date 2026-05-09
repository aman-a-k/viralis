import { BaseAgent, AgentResponse } from './base';
import { VideoCreator } from '../services/videoCreator';

export class VideoAgent extends BaseAgent {
  constructor() {
    super('VideoProduction', 'a professional video editor and motion graphics artist');
  }

  async run(contentData: any): Promise<AgentResponse> {
    this.log(`Rendering video for content: ${contentData.polished?.polishedScript.substring(0, 50)}...`);
    
    try {
      // 1. Prepare the content for rendering
      // We map the agent's output back to the format the service expects
      const serviceContent = {
        script: contentData.polished?.polishedScript || contentData.original.script,
        visualPrompts: contentData.polished?.refinedVisualPrompts || contentData.original.visualPrompts,
        captions: contentData.original.captions // Currently keeping original captions mapping
      };

      // 2. Perform the actual render
      const videoPath = await VideoCreator.renderVideo(serviceContent);
      
      // 3. AI analysis of the production quality (Simulated for now)
      const productionNote = `Video rendered successfully at ${videoPath}. Visual style: High-contrast, dynamic text overlays.`;

      return {
        success: true,
        message: 'Video production completed.',
        data: {
          videoPath,
          productionNote
        }
      };
    } catch (error: any) {
      this.log(`Error in VideoAgent: ${error.message}`);
      return {
        success: false,
        message: 'Failed to produce video.',
        error: error.message
      };
    }
  }
}
