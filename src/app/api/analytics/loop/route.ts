import { NextResponse } from 'next/server';
import { requireWorkspace } from '@/lib/workspace';
import { errorResponse } from '@/lib/http';
import { FeedbackLoopService } from '@/services/feedbackLoopService';

export async function GET() {
  try {
    const ctx = await requireWorkspace();
    return NextResponse.json({ success: true, report: await FeedbackLoopService.getFeedbackLoopReport(ctx.workspaceId) });
  } catch (error) {
    return errorResponse(error, 'Could not load performance.', 'api/analytics/loop');
  }
}
