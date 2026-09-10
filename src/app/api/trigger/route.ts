import { NextResponse } from 'next/server';
import { WorkflowScheduler } from '@/services/scheduler';
import { requireSession } from '@/lib/apiAuth';

export async function POST() {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  try {
    // Run asynchronously so we don't block the UI
    WorkflowScheduler.runDailyJob();
    return NextResponse.json({ success: true, message: 'Workflow triggered successfully.' });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to trigger workflow' }, { status: 500 });
  }
}
