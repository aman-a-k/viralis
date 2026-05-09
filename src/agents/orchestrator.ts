import { TrendAgent } from './trendAgent';
import { ContentAgent } from './contentAgent';
import { VideoAgent } from './videoAgent';
import { PublisherAgent } from './publisherAgent';

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

      // 3. Produce Video
      const videoResult = await this.videoAgent.run(contentResult.data);
      if (!videoResult.success) throw new Error(videoResult.message);

      // 4. Publish Content
      const publishResult = await this.publisherAgent.run({
        videoPath: videoResult.data.videoPath,
        content: contentResult.data
      });

      if (publishResult.success) {
        console.log('--- Workflow Completed Successfully ---');
      } else {
        console.error('--- Workflow Failed at Publishing ---');
      }

    } catch (error: any) {
      console.error(`[Orchestrator] Fatal Error: ${error.message}`);
    }
  }
}
