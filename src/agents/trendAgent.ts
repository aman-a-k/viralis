import { BaseAgent, AgentResponse } from './base';
import { TrendAnalyzer } from '../services/trendAnalyzer';

export class TrendAgent extends BaseAgent {
  constructor() {
    super('TrendIntelligence', 'an expert trend researcher and market analyst');
  }

  async run(): Promise<AgentResponse> {
    this.log('Searching for viral trends...');
    
    try {
      // 1. Get raw trends from the service
      const rawTrend = await TrendAnalyzer.getDailyTrend();
      
      // 2. Use AI to analyze if this trend is suitable for social media automation
      const analysisPrompt = `
      I found the following trending topic: "${rawTrend.topic}"
      Keywords: ${rawTrend.keywords.join(', ')}
      Traffic Score: ${rawTrend.score}
      
      Evaluate this topic for its potential to go viral in a short-form video (Shorts/Reels/TikTok).
      Provide a brief analysis and decide if we should proceed.
      Return the response in JSON format:
      {
        "isViable": boolean,
        "analysis": "string",
        "recommendedAngle": "string",
        "potentialAudience": "string"
      }
      `;
      
      const aiAnalysis = await this.chat(analysisPrompt);
      const cleanedAnalysis = aiAnalysis.replace(/```json/g, '').replace(/```/g, '').trim();
      const analysisResult = JSON.parse(cleanedAnalysis);
      
      return {
        success: true,
        message: 'Trend analysis completed.',
        data: {
          originalTrend: rawTrend,
          aiAnalysis: analysisResult
        }
      };
    } catch (error: any) {
      this.log(`Error in TrendAgent: ${error.message}`);
      return {
        success: false,
        message: 'Failed to analyze trends.',
        error: error.message
      };
    }
  }
}
