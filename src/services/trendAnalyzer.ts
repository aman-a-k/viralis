// @ts-expect-error google-trends-api has no official type definitions
import googleTrends from 'google-trends-api';
import { TrendData } from '../types';

export class TrendAnalyzer {
  /**
   * Discovers daily trending topics using Google Trends API.
   */
  static async getDailyTrend(): Promise<TrendData> {
    console.log("[TrendAnalyzer] Fetching today's top trend from Google Trends...");
    
    try {
      const today = new Date();
      
      const res = await googleTrends.dailyTrends({
        trendDate: today,
        geo: 'US',
      });

      const parsedData = JSON.parse(res);
      const days = parsedData.default.trendingSearchesDays;
      
      if (!days || days.length === 0) {
        throw new Error("No trends found");
      }

      const topTrend = days[0].trendingSearches[0];
      const topicTitle = topTrend.title.query;
      
      // Extract related keywords/articles
      const relatedQueries = topTrend.relatedQueries.map((q: {query: string}) => q.query);
      const articleTitles = topTrend.articles.map((a: {title: string}) => a.title).slice(0, 3);
      
      const keywords = [...new Set([...relatedQueries, ...articleTitles])].slice(0, 5) as string[];
      
      // If we don't get good keywords, add some generic viral ones
      if (keywords.length < 3) {
        keywords.push("viral", "trending", "news");
      }

      console.log(`[TrendAnalyzer] Selected Real Trend: ${topicTitle}`);
      
      return {
        topic: topicTitle,
        score: parseInt(topTrend.formattedTraffic.replace(/[^0-9]/g, '')) || 100000,
        keywords: keywords
      };

    } catch (error) {
      console.error("[TrendAnalyzer] Error fetching real trend, falling back to AI generated topics...", error);
      
      // Fallback
      const fallbackTrends = [
        { topic: "AI in Everyday Life", score: 98000, keywords: ["ai", "future", "tech", "automation"] },
        { topic: "SpaceX Mars Mission Update", score: 95000, keywords: ["spacex", "mars", "elon musk", "space"] },
      ];

      return fallbackTrends[Math.floor(Math.random() * fallbackTrends.length)];
    }
  }
}
