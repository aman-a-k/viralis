import { TrendAgent } from './trendAgent';
import { ContentAgent } from './contentAgent';
import { prisma } from '../lib/prisma';

/**
 * Script ideas: discover a trend -> write + optimize a script -> drop it in
 * the review queue. This produces a script for the creator to record — it
 * does not generate a video.
 */
export class Orchestrator {
  private trendAgent = new TrendAgent();
  private contentAgent = new ContentAgent();

  async executeFullWorkflow(workspaceId: string) {
    console.log('[Orchestrator] Autopilot cycle starting…');

    const trendResult = await this.trendAgent.run(workspaceId);
    if (!trendResult.success) throw new Error(trendResult.error || trendResult.message);

    const { originalTrend, aiAnalysis } = trendResult.data!;
    if (aiAnalysis?.isViable === false) {
      console.log(`[Orchestrator] "${originalTrend.topic}" judged not viable — skipping.`);
      return { success: true, message: `Skipped "${originalTrend.topic}" (not viable).` };
    }

    const contentResult = await this.contentAgent.run({ ...originalTrend, workspaceId });
    if (!contentResult.success) throw new Error(contentResult.error || contentResult.message);

    const { original, polished } = contentResult.data!;

    await prisma.approvalQueue.create({
      data: {
        workspaceId,
        topic: originalTrend.topic,
        script: polished?.polishedScript || original.script,
        visualPrompts: JSON.stringify(polished?.refinedScenes || original.scenes || []),
        captions: JSON.stringify(original.captions || []),
        seoTitle: polished?.title || null,
        seoDescription: polished?.description || null,
        seoTags: JSON.stringify(polished?.tags || []),
        status: 'pending',
      },
    });

    console.log(`[Orchestrator] "${originalTrend.topic}" sent to approval queue.`);
    return { success: true, message: `A script about "${originalTrend.topic}" is in your review queue.` };
  }
}
