import { NextResponse } from 'next/server';
import { isWorkerRequest } from '@/lib/workerAuth';
import { heartbeatJob, finishJob, failJob } from '@/lib/jobs';
import { prisma } from '@/lib/prisma';
import { onWorkerJobSucceeded, onWorkerJobFailed, invalidWorkerResult } from '@/services/pipeline';

export const maxDuration = 60;

type Params = { params: Promise<{ jobId: string }> };

/**
 * Worker progress reports for a job it holds:
 *   { action: "heartbeat", workerId, progress? }
 *   { action: "complete", workerId, result }
 *   { action: "fail", workerId, error, retryable }
 * A worker whose lease lapsed (and whose job was re-claimed) gets 409 and
 * must drop the job.
 */
export async function POST(req: Request, { params }: Params) {
  if (!isWorkerRequest(req)) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  const { jobId } = await params;
  const body = await req.json().catch(() => ({}));
  const holder = `worker:${body.workerId}`;

  if (body.action === 'heartbeat') {
    const ok = await heartbeatJob(jobId, holder, typeof body.progress === 'string' ? body.progress.slice(0, 120) : undefined);
    return NextResponse.json({ ok }, { status: ok ? 200 : 409 });
  }

  if (body.action === 'complete') {
    const held = await prisma.job.findUnique({ where: { id: jobId } });
    if (!held || held.lockedBy !== holder || held.status !== 'running') return NextResponse.json({ ok: false }, { status: 409 });
    const invalid = invalidWorkerResult(held, body.result);
    if (invalid) {
      console.error('[worker complete] rejected result for', jobId, invalid);
      const res = await failJob(jobId, holder, invalid, true);
      if (res) await onWorkerJobFailed(res.job, invalid, res.terminal);
      return NextResponse.json({ ok: false, error: invalid }, { status: 422 });
    }
    // Transcripts are stored on the project; the job keeps only a summary.
    const summary = Array.isArray(body.result?.segments)
      ? { segments: body.result.segments.length, durationSeconds: body.result.durationSeconds }
      : body.result;
    const job = await finishJob(jobId, holder, summary);
    if (!job) return NextResponse.json({ ok: false }, { status: 409 });
    try {
      await onWorkerJobSucceeded(job, body.result);
    } catch (err) {
      console.error('[worker complete] post-processing failed', jobId, err);
      await onWorkerJobFailed(job, 'Finishing this job failed. Please try again.', true);
    }
    return NextResponse.json({ ok: true });
  }

  if (body.action === 'fail') {
    const error = typeof body.error === 'string' && body.error ? body.error.slice(0, 500) : 'Processing failed.';
    const res = await failJob(jobId, holder, error, body.retryable !== false);
    if (!res) return NextResponse.json({ ok: false }, { status: 409 });
    await onWorkerJobFailed(res.job, error, res.terminal);
    return NextResponse.json({ ok: true, willRetry: !res.terminal });
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}
