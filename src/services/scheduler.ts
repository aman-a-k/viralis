import { Orchestrator } from '../agents/orchestrator';

export class WorkflowScheduler {
  private static orchestrator = new Orchestrator();
  private static running = false;

  static async runDailyJob(): Promise<{ success: boolean; message: string }> {
    if (this.running) return { success: false, message: 'A workflow cycle is already running.' };
    this.running = true;
    console.log('[Scheduler] Autopilot workflow starting');

    try {
      const result = await this.orchestrator.executeFullWorkflow();
      console.log('[Scheduler] Cycle complete.');
      return result;
    } catch (error) {
      const { describeLlmError } = await import('../lib/llm');
      const message = describeLlmError(error);
      console.error(`[Scheduler] Workflow failed: ${message}`);
      return { success: false, message };
    } finally {
      this.running = false;
    }
  }

  /** Optional background daemon (not used by the web app). */
  static async initCronJobs() {
    const cron = (await import('node-cron')).default;
    cron.schedule('0 8 * * *', () => this.runDailyJob());
    console.log('[Scheduler] Daily autopilot cron registered (08:00).');
  }
}
