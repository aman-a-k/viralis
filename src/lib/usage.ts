import type { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { PLANS, ENTITLED_STATUSES, type Plan } from './plans';
import { paymentRequired } from './http';

export type UsageMetric = 'source_seconds' | 'exports';

export interface Entitlement {
  plan: Plan;
  /** "subscription" (paid, in period), "trial" (one-time), or "none". */
  source: 'subscription' | 'trial' | 'none' | 'unlimited';
  periodStart: Date;
  periodEnd: Date | null;
  subscriptionStatus: string | null;
  cancelAtPeriodEnd: boolean;
  limits: { source_seconds: number; exports: number };
}

const EPOCH = new Date(0);

/**
 * What the workspace is currently entitled to. A verified, in-period paid
 * subscription wins; otherwise the one-time trial (counted over the
 * workspace's lifetime); otherwise nothing.
 */
export async function getEntitlement(workspaceId: string, opts: { unlimited?: boolean } = {}): Promise<Entitlement> {
  const [workspace, sub] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: workspaceId }, select: { trialGranted: true } }),
    prisma.subscription.findUnique({ where: { workspaceId } }),
  ]);

  if (opts.unlimited) {
    return {
      plan: PLANS.growth,
      source: 'unlimited',
      periodStart: EPOCH,
      periodEnd: null,
      subscriptionStatus: sub?.status ?? null,
      cancelAtPeriodEnd: false,
      limits: { source_seconds: Number.MAX_SAFE_INTEGER, exports: Number.MAX_SAFE_INTEGER },
    };
  }

  const now = Date.now();
  if (
    sub &&
    ENTITLED_STATUSES.has(sub.status) &&
    sub.currentPeriodStart &&
    (!sub.currentPeriodEnd || sub.currentPeriodEnd.getTime() > now) &&
    sub.planId in PLANS
  ) {
    const plan = PLANS[sub.planId as keyof typeof PLANS];
    return {
      plan,
      source: 'subscription',
      periodStart: sub.currentPeriodStart,
      periodEnd: sub.currentPeriodEnd,
      subscriptionStatus: sub.status,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      limits: { source_seconds: plan.sourceMinutes * 60, exports: plan.exports },
    };
  }

  const trial = PLANS.trial;
  const eligible = !!workspace?.trialGranted;
  return {
    plan: trial,
    source: eligible ? 'trial' : 'none',
    periodStart: EPOCH,
    periodEnd: null,
    subscriptionStatus: sub?.status ?? null,
    cancelAtPeriodEnd: sub?.cancelAtPeriodEnd ?? false,
    limits: eligible ? { source_seconds: trial.sourceMinutes * 60, exports: trial.exports } : { source_seconds: 0, exports: 0 },
  };
}

type Tx = Prisma.TransactionClient;

async function usedInPeriod(tx: Tx, workspaceId: string, metric: UsageMetric, from: Date, to: Date | null) {
  const agg = await tx.usageEntry.aggregate({
    _sum: { amount: true },
    where: {
      workspaceId,
      metric,
      status: { in: ['reserved', 'committed'] },
      createdAt: { gte: from, ...(to ? { lt: to } : {}) },
    },
  });
  return agg._sum.amount ?? 0;
}

export async function getUsage(workspaceId: string, ent?: Entitlement) {
  const e = ent ?? (await getEntitlement(workspaceId));
  const [source, exports] = await Promise.all([
    usedInPeriod(prisma, workspaceId, 'source_seconds', e.periodStart, e.periodEnd),
    usedInPeriod(prisma, workspaceId, 'exports', e.periodStart, e.periodEnd),
  ]);
  return { source_seconds: source, exports };
}

const LIMIT_MESSAGES: Record<UsageMetric, (e: Entitlement, remaining: number) => string> = {
  source_seconds: (e, remaining) =>
    e.source === 'none'
      ? 'Choose a plan to process recordings.'
      : `This recording needs more processing time than you have left (${Math.floor(remaining / 60)} min remaining${e.source === 'trial' ? ' on your trial' : ' this billing period'}). Upgrade or wait for your allowance to renew.`,
  exports: (e) =>
    e.source === 'none'
      ? 'Choose a plan to export clips.'
      : `You've used all ${e.limits.exports} exports${e.source === 'trial' ? ' in your trial' : ' for this billing period'}. Upgrade or wait for your allowance to renew.`,
};

/**
 * Reserves allowance before work starts. Serialized per workspace with a
 * transaction-scoped advisory lock, so two concurrent requests can't both
 * see "enough left" and overspend. Throws HTTP 402 when over the limit.
 */
export async function reserveUsage(
  workspaceId: string,
  metric: UsageMetric,
  amount: number,
  ref: { refType: 'project' | 'clip'; refId?: string; note?: string },
  opts: { unlimited?: boolean } = {}
) {
  const ent = await getEntitlement(workspaceId, opts);
  const qty = Math.max(1, Math.ceil(amount));
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${workspaceId}))`;
    const used = await usedInPeriod(tx, workspaceId, metric, ent.periodStart, ent.periodEnd);
    const limit = ent.limits[metric];
    if (used + qty > limit) throw paymentRequired(LIMIT_MESSAGES[metric](ent, Math.max(0, limit - used)));
    return tx.usageEntry.create({
      data: { workspaceId, metric, amount: qty, status: 'reserved', refType: ref.refType, refId: ref.refId, note: ref.note },
    });
  });
}

/** Finalizes a reservation, optionally correcting the amount to what was actually used. */
export async function commitUsage(entryId: string, actualAmount?: number) {
  await prisma.usageEntry.updateMany({
    where: { id: entryId, status: 'reserved' },
    data: { status: 'committed', ...(actualAmount !== undefined ? { amount: Math.max(1, Math.ceil(actualAmount)) } : {}) },
  });
}

/** Returns a reservation to the allowance (failed or canceled work isn't charged). */
export async function releaseUsage(entryId: string | null | undefined, note?: string) {
  if (!entryId) return;
  await prisma.usageEntry.updateMany({
    where: { id: entryId, status: 'reserved' },
    data: { status: 'released', ...(note ? { note } : {}) },
  });
}

/** Attaches a reservation made before its record existed. */
export async function linkUsage(entryId: string, refId: string) {
  await prisma.usageEntry.update({ where: { id: entryId }, data: { refId } });
}
