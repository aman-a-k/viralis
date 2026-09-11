import { TrendAgent } from './trendAgent';
import { ContentAgent } from './contentAgent';
import { prisma } from '../lib/prisma';

/**
 * Autopilot: discover a trend -> write + optimize a script -> drop it in the
 * approval queue for a human to review. Rendering + publishing happen after
 * approval, on the media worker.
 */
export class Orchestrator {
  private trendAgent = new TrendAgent();
  private contentAgent = new ContentAgent();

  async executeFullWorkflow() {
    console.log('[Orchestrator] Autopilot cycle starting…');

    const trendResult = await this.trendAgent.run();
    if (!trendResult.success) throw new Error(trendResult.error || trendResult.message);

    const { originalTrend, aiAnalysis } = trendResult.data;
    if (aiAnalysis?.isViable === false) {
      console.log(`[Orchestrator] "${originalTrend.topic}" judged not viable — skipping.`);
      return { success: true, message: `Skipped "${originalTrend.topic}" (not viable).` };
    }

    const contentResult = await this.contentAgent.run(originalTrend);
    if (!contentResult.success) throw new Error(contentResult.error || contentResult.message);

    const { original, polished } = contentResult.data;

    await prisma.approvalQueue.create({
      data: {
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
    return { success: true, message: `"${originalTrend.topic}" is in the approval queue.` };
  }
}
