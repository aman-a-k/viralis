import { NextResponse } from 'next/server';
import { requireWorkspace } from '@/lib/workspace';
import { errorResponse, badRequest } from '@/lib/http';
import { ENTITLED_STATUSES } from '@/lib/plans';
import { confirmCheckout } from '@/services/billing';

/**
 * Called by the browser after Razorpay Checkout completes. Verifies the
 * checkout signature, then reads the subscription's real state from
 * Razorpay. Access follows that state — not this request.
 */
export async function POST(req: Request) {
  try {
    const ctx = await requireWorkspace({ role: 'owner' });
    const b = await req.json().catch(() => ({}));
    if (![b.razorpay_payment_id, b.razorpay_subscription_id, b.razorpay_signature].every((v) => typeof v === 'string' && v)) {
      throw badRequest('Missing payment details.');
    }
    const sub = await confirmCheckout(ctx.workspaceId, {
      paymentId: b.razorpay_payment_id,
      subscriptionId: b.razorpay_subscription_id,
      signature: b.razorpay_signature,
    });
    const active = !!sub && ENTITLED_STATUSES.has(sub.status);
    return NextResponse.json({
      success: true,
      active,
      status: sub?.status,
      message: active ? 'Your subscription is active.' : 'Payment received — we’ll activate your plan as soon as the payment provider confirms it (usually within a minute).',
    });
  } catch (error) {
    return errorResponse(error, 'Could not confirm the payment.', 'api/billing/confirm');
  }
}
