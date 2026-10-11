import { NextResponse } from 'next/server';
import { requireWorkspace, audit } from '@/lib/workspace';
import { errorResponse } from '@/lib/http';
import { cancelSubscription } from '@/services/billing';

/** Cancels at the end of the paid period (access continues until then). */
export async function POST() {
  try {
    const ctx = await requireWorkspace({ role: 'owner' });
    const sub = await cancelSubscription(ctx.workspaceId);
    await audit(ctx, 'billing.cancel', { status: sub?.status });
    return NextResponse.json({
      success: true,
      message: sub?.currentPeriodEnd
        ? `Canceled. You keep your plan until ${sub.currentPeriodEnd.toDateString()}, and won't be charged again.`
        : 'Canceled. You won’t be charged again.',
    });
  } catch (error) {
    return errorResponse(error, 'Could not cancel the subscription.', 'api/billing/cancel');
  }
}
