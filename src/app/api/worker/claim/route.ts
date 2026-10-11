import { NextResponse, after } from 'next/server';
import { isWorkerRequest } from '@/lib/workerAuth';
import { claimJob, WORKER_JOB_TYPES } from '@/lib/jobs';
import { workerAssignment, runAnalysisSlice, sweepAbandonedJobs, onWorkerJobFailed } from '@/services/pipeline';
import { failJob } from '@/lib/jobs';

export const maxDuration = 60;

/**
 * The media worker asks for its next job here (on a timer, and right after
 * the app wakes it). Each call also nudges background housekeeping: one
 * analysis slice and the abandoned-job sweep.
 */
export async function POST(req: Request) {
  if (!isWorkerRequest(req)) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  const { workerId } = await req.json().catch(() => ({}));
  if (typeof workerId !== 'string' || !workerId) return NextResponse.json({ error: 'workerId is required.' }, { status: 400 });

  after(async () => {
    await sweepAbandonedJobs().catch((e) => console.error('[sweep]', e));
    await runAnalysisSlice({ budgetMs: 35_000 }).catch((e) => console.error('[analysis]', e));
  });

  const job = await claimJob(`worker:${workerId}`, WORKER_JOB_TYPES);
  if (!job) return NextResponse.json({ job: null });
  try {
    return NextResponse.json({ job: await workerAssignment(job) });
  } catch (err) {
    // e.g. the source file was deleted — nothing a retry would fix.
    const res = await failJob(job.id, `worker:${workerId}`, 'The source recording is no longer available.', false);
    if (res) await onWorkerJobFailed(res.job, res.job.error || 'Source unavailable.', true);
    console.error('[worker claim] could not prepare job', job.id, err);
    return NextResponse.json({ job: null });
  }
}
