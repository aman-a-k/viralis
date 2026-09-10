import { NextResponse } from 'next/server';
import { WorkflowScheduler } from '@/services/scheduler';
import { requireSession } from '@/lib/apiAuth';

export async function POST() {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  try {
    const result = await WorkflowScheduler.runDailyJob();
    return NextResponse.json({
      success: result.success,
      message: result.message,
    }, { status: result.success ? 200 : 502 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to trigger workflow' },
      { status: 500 }
    );
  }
}
