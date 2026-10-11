import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/lib/prisma';
import { reserveUsage, commitUsage, releaseUsage, getEntitlement, getUsage } from '@/lib/usage';
import { PLANS } from '@/lib/plans';
import { hasDb, resetDb, makeUser } from './helpers';

describe.skipIf(!hasDb)('usage ledger', () => {
  let ws: string;
  beforeEach(async () => {
    await resetDb();
    ws = (await makeUser('u@example.com')).workspaceId;
  });

  it('new accounts get the one-time trial', async () => {
    const e = await getEntitlement(ws);
    expect(e.source).toBe('trial');
    expect(e.limits.source_seconds).toBe(PLANS.trial.sourceMinutes * 60);
    expect(e.limits.exports).toBe(PLANS.trial.exports);
  });

  it('concurrent requests cannot overspend the allowance', async () => {
    // Trial: 15 minutes. Five simultaneous 5-minute reservations -> exactly 3 fit.
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () => reserveUsage(ws, 'source_seconds', 300, { refType: 'project' }))
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(3);
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(rejected).toHaveLength(2);
    expect(rejected[0].reason.status).toBe(402);
    expect((await getUsage(ws)).source_seconds).toBe(900);
  });

  it('failed work is not charged', async () => {
    const r = await reserveUsage(ws, 'exports', 1, { refType: 'clip' });
    await releaseUsage(r.id, 'render failed');
    expect((await getUsage(ws)).exports).toBe(0);
    // Releasing twice or committing a released entry changes nothing.
    await releaseUsage(r.id);
    await commitUsage(r.id);
    expect((await getUsage(ws)).exports).toBe(0);
  });

  it('commit can correct an estimate to the real length', async () => {
    const r = await reserveUsage(ws, 'source_seconds', 600, { refType: 'project' });
    await commitUsage(r.id, 420);
    expect((await getUsage(ws)).source_seconds).toBe(420);
  });

  it('an active subscription switches to the paid allowance for its period', async () => {
    await reserveUsage(ws, 'source_seconds', 900, { refType: 'project' }); // used during the trial
    const now = Date.now();
    await prisma.subscription.create({
      data: {
        workspaceId: ws, providerSubscriptionId: 'sub_1', planId: 'creator', status: 'active',
        currentPeriodStart: new Date(now + 1000), currentPeriodEnd: new Date(now + 30 * 86400_000),
      },
    });
    const e = await getEntitlement(ws);
    expect(e.source).toBe('subscription');
    expect(e.limits.source_seconds).toBe(PLANS.creator.sourceMinutes * 60);
    // Trial-era usage doesn't count against the new period.
    await new Promise((r) => setTimeout(r, 1100));
    expect((await getUsage(ws)).source_seconds).toBe(0);
  });

  it('a canceled or unpaid subscription grants nothing extra', async () => {
    await prisma.workspace.update({ where: { id: ws }, data: { trialGranted: false } });
    await prisma.subscription.create({
      data: { workspaceId: ws, providerSubscriptionId: 'sub_2', planId: 'creator', status: 'halted', currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 86400_000) },
    });
    const e = await getEntitlement(ws);
    expect(e.source).toBe('none');
    await expect(reserveUsage(ws, 'exports', 1, { refType: 'clip' })).rejects.toMatchObject({ status: 402 });
  });
});
