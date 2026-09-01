import { BaseAgent, AgentResponse } from './base';
import { TrendAnalyzer } from '../services/trendAnalyzer';
import OpenAI from 'openai';
import { prisma } from '../lib/prisma';

export class TrendAgent extends BaseAgent {
  constructor() {
    super('TrendIntelligence', 'an expert trend researcher and market analyst who uses real-time data to find viral opportunities');
  }

  async run(): Promise<AgentResponse> {
    this.log('Evaluating current digital landscape...');
    
    const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
      {
        type: 'function',
        function: {
          name: 'get_daily_trends',
          description: 'Fetches the latest trending topics and their traffic scores from Google Trends',
          parameters: { type: 'object', properties: {} }
        }
      }
    ];

    try {
      const response = await this.chat(
        "Find the most viable trending topic for a viral social media video today. Use the get_daily_trends tool.",
        "gpt-4o",
        tools
      );

      if (response.tool_calls) {
        const toolCall = response.tool_calls[0];
        const rawTrends = await this.executeTool(toolCall, {
          get_daily_trends: async () => await TrendAnalyzer.getDailyTrend()
        });

        // Now analyze the result
        const analysisPrompt = `
        I found this trend: ${JSON.stringify(rawTrends)}
        
        Evaluate its potential for a viral Short/Reel. 
        Provide a JSON response with: isViable (boolean), analysis (string), recommendedAngle (string).
        `;
        
        const finalDecision = await this.chat(analysisPrompt, "gpt-4o-mini");
        const cleaned = finalDecision.content?.replace(/```json/g, '').replace(/```/g, '').trim() || "{}";
        const result = JSON.parse(cleaned);

        // 3. Save to database for history
        await prisma.trend.create({
          data: {
            topic: rawTrends.topic,
            score: rawTrends.score,
            keywords: JSON.stringify(rawTrends.keywords),
            isViable: result.isViable,
            analysis: result.analysis
          }
        });

        return {
          success: true,
          message: 'Trend identified and analyzed.',
          data: { originalTrend: rawTrends, aiAnalysis: result }
        };
      }

      return { success: false, message: 'Agent failed to use search tools.' };
    } catch (error: any) {
      this.log(`Error: ${error.message}`);
      return { success: false, message: 'Trend analysis failed.', error: error.message };
    }
  }
}
