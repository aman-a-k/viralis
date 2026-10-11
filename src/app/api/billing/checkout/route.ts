import { NextResponse } from 'next/server';
import { requireWorkspace, audit } from '@/lib/workspace';
import { errorResponse, badRequest } from '@/lib/http';
import { isPlanId } from '@/lib/plans';
import { createCheckout } from '@/services/billing';

export async function POST(req: Request) {
  try {
    const ctx = await requireWorkspace({ role: 'owner', verified: true });
    const { plan } = await req.json().catch(() => ({}));
    if (!isPlanId(plan)) throw badRequest('Choose a plan.');
    const checkout = await createCheckout(ctx.workspaceId, plan, ctx.email);
    await audit(ctx, 'billing.checkout', { plan });
    return NextResponse.json({
      success: true,
      keyId: checkout.keyId,
      subscriptionId: checkout.subscriptionId,
      planName: checkout.plan.name,
      email: checkout.email,
    });
  } catch (error) {
    return errorResponse(error, 'Could not start checkout.', 'api/billing/checkout');
  }
}
