import cron from 'node-cron';
import { TrendAnalyzer } from './trendAnalyzer';
import { ContentGenerator } from './contentGenerator';
import { VideoCreator } from './videoCreator';
import { Publisher } from './publisher';
import { AnalyticsService } from './analytics';

export class WorkflowScheduler {
  static async runDailyJob(retryCount = 0) {
    console.log("=======================================");
    console.log(`[Scheduler] Starting Daily AI Content Workflow (Attempt: ${retryCount + 1})`);
    console.log("=======================================");

    try {
      // 1. Get Trend
      const trend = await TrendAnalyzer.getDailyTrend();

      // 2. Generate Content Script & Visuals
      const content = await ContentGenerator.generateVideoContent(trend);

      // 3. Render Video
      const videoUrl = await VideoCreator.renderVideo(content);

      // 4. Publish
      const published = await Publisher.publishVideo(
        videoUrl, 
        `${trend.topic} - You Won't Believe This! 🤯`, 
        `Daily update on ${trend.topic}. \n\n#${trend.keywords.join(" #")}`
      );

      if (!published) {
        throw new Error("Publishing failed.");
      }

      console.log("[Scheduler] Daily Workflow Completed Successfully.");
      
      // 5. Periodic 30-Day Check
      const dayOfMonth = new Date().getDate();
      if (dayOfMonth === 1) {
         await AnalyticsService.verify30DayPerformance();
      }

    } catch (error: any) {
      console.error(`[Scheduler] Workflow failed: ${error.message}`);
      
      if (retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 60000; // Exponential backoff: 1m, 2m, 4m
        console.log(`[Scheduler] Auto-healing: Retrying in ${delay / 60000} minutes...`);
        setTimeout(() => this.runDailyJob(retryCount + 1), delay);
      } else {
        console.error("[Scheduler] Maximum retries reached. Workflow failed for today. Self-healing aborted to prevent infinite loops.");
      }
    }
  }

  static initCronJobs() {
    // Run daily at 08:00 AM
    cron.schedule('0 8 * * *', () => {
      this.runDailyJob();
    });
    console.log("[Scheduler] Cron jobs initialized. Waiting for 08:00 AM...");
  }
}
