import { BaseAgent, AgentResponse } from './base';
import { prisma } from '../lib/prisma';

export class AnalyticsAgent extends BaseAgent {
  constructor() {
    super('PerformanceOptimizer', 'a data scientist and social media algorithms expert');
  }

  async run(): Promise<AgentResponse> {
    this.log('Analyzing past performance data...');
    
    try {
      const videos = await prisma.video.findMany({ 
        where: { status: 'success' },
        take: 50,
        orderBy: { createdAt: 'desc' }
      });

      if (videos.length === 0) {
        return {
          success: true,
          message: 'No video data available for analysis yet.',
          data: { recommendations: 'Start creating and publishing videos to get insights.' }
        };
      }

      const totalViews = videos.reduce((acc, v) => acc + v.views, 0);
      const totalLikes = videos.reduce((acc, v) => acc + v.likes, 0);
      
      const analysisPrompt = `
      Analyze the following performance data for our social media automation:
      Total Videos: ${videos.length}
      Total Views: ${totalViews}
      Total Likes: ${totalLikes}
      
      Identify patterns in successful topics and suggest improvements for the CreativeContent and TrendIntelligence agents.
      What topics should we focus on? What tones are performing best?
      
      Return JSON:
      {
        "performanceSummary": "string",
        "topPerformingNiches": ["string"],
        "strategyAdjustments": ["string"],
        "nextGoal": "string"
      }
      `;
      
      const aiResponse = await this.chat(analysisPrompt);
      const cleanedResponse = aiResponse.replace(/```json/g, '').replace(/```/g, '').trim();
      const optimizationPlan = JSON.parse(cleanedResponse);
      
      return {
        success: true,
        message: 'Performance analysis completed.',
        data: optimizationPlan
      };
    } catch (error: any) {
      this.log(`Error in AnalyticsAgent: ${error.message}`);
      return {
        success: false,
        message: 'Failed to analyze performance.',
        error: error.message
      };
    }
  }
}
