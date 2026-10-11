import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireWorkspace } from '@/lib/workspace';
import { errorResponse } from '@/lib/http';
import { getEntitlement, getUsage } from '@/lib/usage';
import { PLANS } from '@/lib/plans';
import { billingConfigured } from '@/services/billing';

/** Plan, usage and subscription state for the Billing page. */
export async function GET() {
  try {
    const ctx = await requireWorkspace();
    const ent = await getEntitlement(ctx.workspaceId, { unlimited: ctx.isPlatformAdmin });
    const used = await getUsage(ctx.workspaceId, ent);
    const sub = await prisma.subscription.findUnique({ where: { workspaceId: ctx.workspaceId } });
    return NextResponse.json({
      success: true,
      billingAvailable: billingConfigured(),
      canManage: ctx.role !== 'member',
      entitlement: {
        planId: ent.plan.id,
        planName: ent.plan.name,
        source: ent.source,
        periodStart: ent.periodStart.getTime() ? ent.periodStart : null,
        periodEnd: ent.periodEnd,
        limits: { sourceMinutes: Math.floor(ent.limits.source_seconds / 60), exports: ent.limits.exports },
        used: { sourceMinutes: Math.ceil(used.source_seconds / 60), exports: used.exports },
      },
      subscription: sub
        ? { planId: sub.planId, status: sub.status, currentPeriodEnd: sub.currentPeriodEnd, cancelAtPeriodEnd: sub.cancelAtPeriodEnd }
        : null,
      plans: Object.values(PLANS).filter((p) => p.available),
    });
  } catch (error) {
    return errorResponse(error, 'Could not load billing.', 'api/billing');
  }
}
