import cron from 'node-cron';
import { prisma } from '../lib/prisma';
import { Publisher } from './publisher';
import { Orchestrator } from '../agents/orchestrator';

export class WorkflowScheduler {
  private static orchestrator = new Orchestrator();

  static async runDailyJob(retryCount = 0) {
    console.log("=======================================");
    console.log(`[Scheduler] Starting Autonomous AI Workflow (Attempt: ${retryCount + 1})`);
    console.log("=======================================");

    try {
      // Use the intelligent orchestrator to manage the end-to-end flow
      await this.orchestrator.executeFullWorkflow();
      
      console.log("[Scheduler] Autonomous Workflow cycle completed.");

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`[Scheduler] Workflow failed: ${errorMessage}`);
      
      if (retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 60000;
        console.log(`[Scheduler] Auto-healing: Retrying workflow in ${delay / 60000} minutes...`);
        setTimeout(() => this.runDailyJob(retryCount + 1), delay);
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
