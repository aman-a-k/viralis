import { TrendAgent } from './trendAgent';
import { ContentAgent } from './contentAgent';
import { VideoAgent } from './videoAgent';
import { PublisherAgent } from './publisherAgent';
import { prisma } from '../lib/prisma';

export class Orchestrator {
  private trendAgent = new TrendAgent();
  private contentAgent = new ContentAgent();
  private videoAgent = new VideoAgent();
  private publisherAgent = new PublisherAgent();

  async executeFullWorkflow() {
    console.log('--- Starting Orchestrated AI Workflow ---');

    try {
      // 1. Identify Trend
      const trendResult = await this.trendAgent.run();
      if (!trendResult.success) throw new Error(trendResult.message);
      
      const { originalTrend, aiAnalysis } = trendResult.data;
      if (!aiAnalysis.isViable) {
        console.log(`Trend "${originalTrend.topic}" is not viable. Skipping...`);
        return;
      }

      // 2. Generate Content
      const contentResult = await this.contentAgent.run(originalTrend);
      if (!contentResult.success) throw new Error(contentResult.message);

      // 3. Save to Approval Queue (Human-in-the-Loop)
      this.log(`Sending content for "${originalTrend.topic}" to approval queue...`);
      
      await prisma.approvalQueue.create({
        data: {
          topic: originalTrend.topic,
          script: contentResult.data.polished?.polishedScript || contentResult.data.original.script,
          visualPrompts: JSON.stringify(contentResult.data.polished?.refinedVisualPrompts || contentResult.data.original.visualPrompts),
          captions: JSON.stringify(contentResult.data.original.captions),
          status: 'pending'
        }
      });

      console.log('--- Workflow Paused for Approval ---');
      return { success: true, message: 'Content sent to approval queue.' };

    } catch (error: any) {
      console.error(`[Orchestrator] Fatal Error: ${error.message}`);
      return { success: false, message: error.message };
    }
  }
}
