import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePlatformAdmin, audit } from '@/lib/workspace';
import { errorResponse, badRequest, notFound } from '@/lib/http';
import { wakeWorker } from '@/lib/jobs';

/** Re-queues a failed job (admin). Its project/clip resumes from where the job left off. */
export async function POST(req: Request) {
  try {
    const ctx = await requirePlatformAdmin();
    const { jobId } = await req.json().catch(() => ({}));
    const job = await prisma.job.findUnique({ where: { id: String(jobId || '') } });
    if (!job) throw notFound('Job not found.');
    if (job.status !== 'failed') throw badRequest('Only failed jobs can be retried.');
    await prisma.job.update({
      where: { id: job.id },
      data: { status: 'queued', attempts: 0, error: null, runAfter: new Date(), lockedBy: null, leaseUntil: null, finishedAt: null, progress: 'Retrying' },
    });
    if (job.projectId && job.type !== 'render') {
      await prisma.project.update({ where: { id: job.projectId }, data: { status: job.type === 'transcribe' ? 'transcribing' : 'analyzing', errorMessage: null } });
    }
    if (job.clipId && job.type === 'render') {
      await prisma.clip.update({ where: { id: job.clipId }, data: { renderStatus: 'queued', renderError: null, renderJobId: job.id } });
    }
    wakeWorker();
    await audit(ctx, 'admin.job_retry', { jobId: job.id });
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, 'Could not retry the job.', 'api/admin/jobs');
  }
}
