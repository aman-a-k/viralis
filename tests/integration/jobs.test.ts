import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/lib/prisma';
import { enqueueJob, claimJob, heartbeatJob, finishJob, failJob, yieldJob } from '@/lib/jobs';
import { sweepAbandonedJobs } from '@/services/pipeline';
import { reserveUsage, getUsage } from '@/lib/usage';
import { hasDb, resetDb, makeUser, makeProjectWithClip } from './helpers';

describe.skipIf(!hasDb)('durable jobs', () => {
  let ws: string;
  beforeEach(async () => {
    await resetDb();
    ws = (await makeUser('j@example.com')).workspaceId;
  });

  const job = (type: 'transcribe' | 'render' = 'render', extra: Record<string, unknown> = {}) =>
    enqueueJob({ workspaceId: ws, type, payload: { n: 1, ...extra } });

  it('two workers never get the same job', async () => {
    await job();
    await job();
    const [a, b, c] = await Promise.all([claimJob('w1', ['render']), claimJob('w2', ['render']), claimJob('w3', ['render'])]);
    const ids = [a, b, c].filter(Boolean).map((j) => j!.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });

  it('a job whose worker died is handed out again after its lease lapses', async () => {
    const j = await job();
    const first = await claimJob('crashed-worker', ['render']);
    expect(first?.id).toBe(j.id);
    expect(await claimJob('w2', ['render'])).toBeNull(); // still leased
    await prisma.job.update({ where: { id: j.id }, data: { leaseUntil: new Date(Date.now() - 1000) } });
    const again = await claimJob('w2', ['render']);
    expect(again?.id).toBe(j.id);
    expect(again?.attempts).toBe(2);
    // The original worker can no longer report on it.
    expect(await heartbeatJob(j.id, 'crashed-worker')).toBe(false);
    expect(await finishJob(j.id, 'crashed-worker', { stale: true })).toBeNull();
    expect(await finishJob(j.id, 'w2', { ok: true })).not.toBeNull();
  });

  it('retries transient failures with backoff, then fails for good', async () => {
    const j = await enqueueJob({ workspaceId: ws, type: 'render', payload: {}, maxAttempts: 2 });
    await claimJob('w', ['render']);
    const r1 = await failJob(j.id, 'w', 'network', true);
    expect(r1?.terminal).toBe(false);
    expect(r1?.job.status).toBe('queued');
    expect(r1!.job.runAfter.getTime()).toBeGreaterThan(Date.now());
    await prisma.job.update({ where: { id: j.id }, data: { runAfter: new Date() } });
    await claimJob('w', ['render']);
    const r2 = await failJob(j.id, 'w', 'network', true);
    expect(r2?.terminal).toBe(true);
    expect(r2?.job.status).toBe('failed');
  });

  it('yielding a sliced job does not use up attempts', async () => {
    const j = await enqueueJob({ workspaceId: ws, type: 'analyze', payload: {}, maxAttempts: 1 });
    for (let i = 0; i < 3; i++) {
      const c = await claimJob('app', ['analyze']);
      expect(c?.id).toBe(j.id);
      await yieldJob(j.id, 'app', { step: i });
    }
    const final = await prisma.job.findUniqueOrThrow({ where: { id: j.id } });
    expect(final.attempts).toBe(0);
    expect(JSON.parse(final.result!)).toEqual({ step: 2 });
  });

  it('abandoned final attempts fail the clip and return the export', async () => {
    const { clip } = await makeProjectWithClip(ws);
    const usage = await reserveUsage(ws, 'exports', 1, { refType: 'clip', refId: clip.id });
    const j = await enqueueJob({ workspaceId: ws, type: 'render', clipId: clip.id, payload: { clipId: clip.id, usageEntryId: usage.id }, maxAttempts: 1 });
    await prisma.clip.update({ where: { id: clip.id }, data: { renderStatus: 'rendering', renderJobId: j.id } });
    await claimJob('dead', ['render']);
    await prisma.job.update({ where: { id: j.id }, data: { leaseUntil: new Date(Date.now() - 1000) } });

    expect(await sweepAbandonedJobs()).toBe(1);
    const c = await prisma.clip.findUniqueOrThrow({ where: { id: clip.id } });
    expect(c.renderStatus).toBe('failed');
    expect((await getUsage(ws)).exports).toBe(0);
  });
});
