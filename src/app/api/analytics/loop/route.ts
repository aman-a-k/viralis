import { NextResponse } from 'next/server';
import { FeedbackLoopService } from '@/services/feedbackLoopService';

export async function GET() {
  try {
    const report = await FeedbackLoopService.getFeedbackLoopReport();
    return NextResponse.json({ success: true, report });
  } catch (error: any) {
    console.error('[API /api/analytics/loop] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
