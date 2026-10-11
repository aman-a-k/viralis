import { after } from 'next/server';
import type { Job } from '@prisma/client';
import { prisma } from './prisma';

/**
 * Durable job queue in Postgres.
 *
 * - "transcribe" and "render" are claimed by the media worker over HTTP
 *   (/api/worker/*), so the worker never needs database credentials.
 * - "analyze" runs inside this app, a slice at a time (see pipeline.ts).
 *
 * A claim takes a lease; the worker heartbeats while it works. If the worker
 * dies, the lease lapses and the job is claimed again (up to maxAttempts) —
 * a restart delays work instead of losing it.
 */
export type JobType = 'transcribe' | 'render' | 'analyze';
export const WORKER_JOB_TYPES: JobType[] = ['transcribe', 'render'];

export const LEASE_SECONDS = 180;

export function workerConfigured(): boolean {
  return Boolean(process.env.RENDER_WORKER_URL && process.env.RENDER_WORKER_SECRET);
}

/**
 * Nudges the worker to claim work now instead of on its next idle poll (and
 * wakes it if its host spun it down). Fire-and-forget.
 */
export function wakeWorker(): void {
  const url = process.env.RENDER_WORKER_URL;
  const secret = process.env.RENDER_WORKER_SECRET;
  if (!url || !secret) return;
  const ping = () =>
    fetch(`${url.replace(/\/$/, '')}/wake`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(55_000),
    }).catch(() => {});
  try {
    after(ping);
  } catch {
    void ping(); // outside a request (scripts/tests)
  }
}

export async function enqueueJob(input: {
  workspaceId: string;
  type: JobType;
  payload: Record<string, unknown>;
  projectId?: string;
  clipId?: string;
  maxAttempts?: number;
  runAfter?: Date;
}): Promise<Job> {
  const job = await prisma.job.create({
    data: {
      workspaceId: input.workspaceId,
      type: input.type,
      payload: JSON.stringify(input.payload),
      projectId: input.projectId,
      clipId: input.clipId,
      maxAttempts: input.maxAttempts ?? 3,
      runAfter: input.runAfter,
      progress: 'Waiting to start',
    },
  });
  if (WORKER_JOB_TYPES.includes(input.type)) wakeWorker();
  return job;
}

/**
 * Atomically claims the oldest runnable job of the given types: queued and
 * due, or running with an expired lease (its worker died). SKIP LOCKED keeps
 * concurrent claimers from taking the same row.
 */
export async function claimJob(
  workerId: string,
  types: JobType[],
  only: { jobId?: string; projectId?: string } = {}
): Promise<Job | null> {
  const jobId = only.jobId ?? null;
  const projectId = only.projectId ?? null;
  const rows = await prisma.$queryRaw<Job[]>`
    UPDATE "Job" SET
      "status" = 'running',
      "attempts" = "attempts" + 1,
      "lockedBy" = ${workerId},
      "leaseUntil" = NOW() + make_interval(secs => ${LEASE_SECONDS}),
      "startedAt" = COALESCE("startedAt", NOW()),
      "progress" = 'Starting',
      "updatedAt" = NOW()
    WHERE "id" = (
      SELECT "id" FROM "Job"
      WHERE "type" = ANY(${types}::text[])
        AND (${jobId}::text IS NULL OR "id" = ${jobId})
        AND (${projectId}::text IS NULL OR "projectId" = ${projectId})
        AND "attempts" < "maxAttempts"
        AND (
          ("status" = 'queued' AND "runAfter" <= NOW())
          OR ("status" = 'running' AND "leaseUntil" < NOW())
        )
      ORDER BY "createdAt" ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *`;
  return rows[0] ?? null;
}

/** Extends the lease (and records progress) while the holder is still working. */
export async function heartbeatJob(jobId: string, workerId: string, progress?: string): Promise<boolean> {
  const res = await prisma.$executeRaw`
    UPDATE "Job" SET
      "leaseUntil" = NOW() + make_interval(secs => ${LEASE_SECONDS}),
      "progress" = COALESCE(${progress ?? null}, "progress"),
      "updatedAt" = NOW()
    WHERE "id" = ${jobId} AND "lockedBy" = ${workerId} AND "status" = 'running'`;
  return res > 0;
}

/**
 * Marks a job done — only if the caller still holds it (a worker whose lease
 * lapsed and whose job was re-claimed can't overwrite the newer attempt).
 */
export async function finishJob(jobId: string, workerId: string, result: unknown): Promise<Job | null> {
  const res = await prisma.job.updateMany({
    where: { id: jobId, lockedBy: workerId, status: 'running' },
    data: {
      status: 'succeeded',
      result: JSON.stringify(result ?? null),
      progress: 'Done',
      finishedAt: new Date(),
      leaseUntil: null,
      error: null,
    },
  });
  if (res.count === 0) return null;
  return prisma.job.findUnique({ where: { id: jobId } });
}

/**
 * Hands a partly-done job back to the queue without counting it as a failed
 * attempt — used by work that proceeds in slices (analysis of a long
 * recording runs across several requests, saving progress in `result`).
 */
export async function yieldJob(jobId: string, holder: string, progressResult: unknown, opts: { delaySeconds?: number; progress?: string } = {}) {
  await prisma.job.updateMany({
    where: { id: jobId, lockedBy: holder, status: 'running' },
    data: {
      status: 'queued',
      attempts: { decrement: 1 },
      lockedBy: null,
      leaseUntil: null,
      result: JSON.stringify(progressResult ?? null),
      runAfter: new Date(Date.now() + (opts.delaySeconds ?? 0) * 1000),
      ...(opts.progress ? { progress: opts.progress } : {}),
    },
  });
}

/**
 * Records a failure. Retryable failures go back to the queue with backoff
 * until maxAttempts; otherwise the job is failed for good. Returns the job
 * and whether it is now terminally failed.
 */
export async function failJob(
  jobId: string,
  holder: string | null,
  error: string,
  retryable: boolean
): Promise<{ job: Job; terminal: boolean } | null> {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job || job.status !== 'running' || (holder && job.lockedBy !== holder)) return null;

  const canRetry = retryable && job.attempts < job.maxAttempts;
  const backoffSec = Math.min(600, 30 * 2 ** Math.max(0, job.attempts - 1));
  const updated = await prisma.job.update({
    where: { id: jobId },
    data: canRetry
      ? { status: 'queued', error, lockedBy: null, leaseUntil: null, runAfter: new Date(Date.now() + backoffSec * 1000), progress: 'Retrying shortly' }
      : { status: 'failed', error, lockedBy: null, leaseUntil: null, finishedAt: new Date(), progress: 'Failed' },
  });
  if (canRetry) wakeWorker();
  return { job: updated, terminal: !canRetry };
}

/**
 * Running jobs whose lease lapsed on their final attempt can never be
 * claimed again — fail them so their project/clip doesn't spin forever.
 */
export async function findAbandonedJobs(): Promise<Job[]> {
  return prisma.$queryRaw<Job[]>`
    SELECT * FROM "Job"
    WHERE "status" = 'running' AND "leaseUntil" < NOW() AND "attempts" >= "maxAttempts"`;
}

export async function cancelJobs(where: { projectId?: string; clipId?: string; workspaceId: string }) {
  return prisma.job.updateMany({
    where: { ...where, status: { in: ['queued', 'running'] } },
    data: { status: 'canceled', finishedAt: new Date(), leaseUntil: null, progress: 'Canceled' },
  });
}

export function parsePayload<T>(job: Pick<Job, 'payload'>): T {
  try {
    return JSON.parse(job.payload) as T;
  } catch {
    return {} as T;
  }
}
