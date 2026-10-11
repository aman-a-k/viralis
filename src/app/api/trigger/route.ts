import { NextResponse } from 'next/server';
import { requireWorkspace } from '@/lib/workspace';
import { errorResponse } from '@/lib/http';
import { WorkflowScheduler } from '@/services/scheduler';

// Writes a script idea from today's trends (several sequential AI calls).
export const maxDuration = 60;

export async function POST() {
  try {
    const ctx = await requireWorkspace({ verified: true });
    const result = await WorkflowScheduler.runDailyJob(ctx.workspaceId);
    return NextResponse.json({ success: result.success, message: result.message }, { status: result.success ? 200 : 502 });
  } catch (error) {
    return errorResponse(error, 'Could not write a script idea.', 'api/trigger');
  }
}
