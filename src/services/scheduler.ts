import { Orchestrator } from '../agents/orchestrator';

/** Runs the script-ideas workflow for one workspace (one run at a time each). */
export class WorkflowScheduler {
  private static orchestrator = new Orchestrator();
  private static running = new Set<string>();

  static async runDailyJob(workspaceId: string): Promise<{ success: boolean; message: string }> {
    if (this.running.has(workspaceId)) return { success: false, message: 'A run is already in progress.' };
    this.running.add(workspaceId);
    try {
      return await this.orchestrator.executeFullWorkflow(workspaceId);
    } catch (error) {
      const { describeLlmError } = await import('../lib/llm');
      const message = describeLlmError(error);
      console.error(`[Scheduler] Workflow failed: ${message}`);
      return { success: false, message };
    } finally {
      this.running.delete(workspaceId);
    }
  }
}
