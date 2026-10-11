import { BaseAgent, AgentResponse } from './base';
import { TrendAnalyzer } from '../services/trendAnalyzer';
import { prisma } from '../lib/prisma';
import type { TrendData } from '../types';

interface TrendAnalysis {
  isViable: boolean;
  analysis: string;
  recommendedAngle: string;
}

export class TrendAgent extends BaseAgent {
  constructor() {
    super(
      'TrendIntelligence',
      'an expert trend researcher who finds viral short-form video opportunities'
    );
  }

  async run(workspaceId: string): Promise<AgentResponse<{ originalTrend: TrendData; aiAnalysis: TrendAnalysis }>> {
    this.log('Scanning for viral opportunities...');
    try {
      const trend = await TrendAnalyzer.getDailyTrend(workspaceId);

      const analysis = await this.chatJSON<TrendAnalysis>(
        `Trend: "${trend.topic}" (est. interest ${trend.score}/100, keywords: ${trend.keywords.join(', ')}).
Evaluate its potential for a viral Short/Reel. Return JSON:
{"isViable": boolean, "analysis": "1-2 sentences", "recommendedAngle": "the specific hook/angle to take"}`
      );

      await prisma.trend.create({
        data: {
          workspaceId,
          topic: trend.topic,
          score: trend.score,
          keywords: JSON.stringify(trend.keywords),
          isViable: analysis.isViable ?? true,
          analysis: analysis.analysis || '',
        },
      });

      return {
        success: true,
        message: `Trend identified: ${trend.topic}`,
        data: { originalTrend: trend, aiAnalysis: analysis },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.log(`Error: ${message}`);
      return { success: false, message: 'Trend analysis failed.', error: message };
    }
  }
}
