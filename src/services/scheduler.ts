import cron from 'node-cron';
import { TrendAnalyzer } from './trendAnalyzer';
import { ContentGenerator } from './contentGenerator';
import { VideoCreator } from './videoCreator';
import { Publisher } from './publisher';
import { AnalyticsService } from './analytics';
import { prisma } from '../lib/prisma';

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

      // Save to DB as pending
      const dbVideo = await prisma.video.create({
        data: {
          topic: trend.topic,
          videoUrl: videoUrl,
          platform: 'youtube', // primary platform
          status: 'pending'
        }
      });

      // 4. Publish
      const published = await Publisher.publishVideo(
        videoUrl, 
        `${trend.topic} - You Won't Believe This! 🤯`, 
        `Daily update on ${trend.topic}. \n\n#${trend.keywords.join(" #")}`
      );

      if (!published) {
        await prisma.video.update({ where: { id: dbVideo.id }, data: { status: 'failed' } });
        throw new Error("Publishing API failed or timed out.");
      }

      await prisma.video.update({ where: { id: dbVideo.id }, data: { status: 'success' } });
      console.log("[Scheduler] Daily Workflow Completed Successfully.");
      
      // 5. Periodic 30-Day Check
      const dayOfMonth = new Date().getDate();
      if (dayOfMonth === 1) {
         await AnalyticsService.verify30DayPerformance();
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`[Scheduler] Workflow failed: ${errorMessage}`);
      
      if (retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 60000; // Exponential backoff
        console.log(`[Scheduler] Auto-healing: Retrying workflow entirely in ${delay / 60000} minutes...`);
        setTimeout(() => this.runDailyJob(retryCount + 1), delay);
      } else {
        console.error("[Scheduler] Maximum retries reached. Waiting for the Self-Healer daemon to pick up failed tasks.");
      }
    }
  }

  static async runSelfHealer() {
    console.log("[SelfHealer] Checking for failed or stuck tasks...");
    const failedVideos = await prisma.video.findMany({
      where: { status: 'failed' }
    });

    for (const video of failedVideos) {
      console.log(`[SelfHealer] Attempting to re-publish failed video: ${video.topic}`);
      try {
        const published = await Publisher.publishVideo(
          video.videoUrl,
          `${video.topic} - You Won't Believe This! 🤯`,
          `Re-upload attempt for ${video.topic}. #trending`
        );
        
        if (published) {
          await prisma.video.update({ where: { id: video.id }, data: { status: 'success' } });
          console.log(`[SelfHealer] Successfully healed and published: ${video.topic}`);
        } else {
           console.log(`[SelfHealer] Failed again for: ${video.topic}. Will try again next cycle.`);
        }
      } catch (err) {
        console.error(`[SelfHealer] Error healing video ${video.topic}:`, err);
      }
    }
  }

  static initCronJobs() {
    // Run primary job daily at 08:00 AM
    cron.schedule('0 8 * * *', () => {
      this.runDailyJob();
    });
    
    // Run self-healer every hour to verify if anything is not posted
    cron.schedule('0 * * * *', () => {
      this.runSelfHealer();
    });
    
    console.log("[Scheduler] Cron jobs and Self-Healer initialized. Daemon running.");
  }
}
