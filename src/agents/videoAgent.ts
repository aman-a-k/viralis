import { BaseAgent, AgentResponse } from './base';
import { VideoCreator } from '../services/videoCreator';
import OpenAI from 'openai';

export class VideoAgent extends BaseAgent {
  constructor() {
    super('VideoProduction', 'a professional video editor who uses FFmpeg to create high-quality social media content');
  }

  async run(contentData: any): Promise<AgentResponse> {
    this.log('Starting video production pipeline...');
    
    const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
      {
        type: 'function',
        function: {
          name: 'render_video',
          description: 'Renders an MP4 video with audio and captions',
          parameters: {
            type: 'object',
            properties: {
              script: { type: 'string' },
              visualPrompts: { type: 'array', items: { type: 'string' } }
            },
            required: ['script', 'visualPrompts']
          }
        }
      }
    ];

    try {
      const script = contentData.polished?.polishedScript || contentData.original.script;
      const prompts = contentData.polished?.refinedVisualPrompts || contentData.original.visualPrompts;

      const response = await this.chat(
        `Produce a high-quality video for the script: "${script.substring(0, 100)}...". Use the render_video tool.`,
        "gpt-4o",
        tools
      );

      if (response.tool_calls) {
        const toolCall = response.tool_calls[0];
        const videoPath = await this.executeTool(toolCall, {
          render_video: async (args: any) => await VideoCreator.renderVideo({
            ...args,
            captions: contentData.original.captions
          })
        });

        return {
          success: true,
          message: 'Video produced successfully.',
          data: { videoPath, productionNote: 'Rendered with dynamic text and optimized audio.' }
        };
      }

      return { success: false, message: 'Agent failed to trigger production tools.' };
    } catch (error: any) {
      this.log(`Error: ${error.message}`);
      return { success: false, message: 'Video production failed.', error: error.message };
    }
  }
}
