import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePlatformAdmin } from '@/lib/workspace';
import { errorResponse } from '@/lib/http';
import { workerConfigured } from '@/lib/jobs';
import { billingConfigured } from '@/services/billing';
import { emailConfigured } from '@/lib/email';
import { aiConfigured } from '@/lib/llm';
import { platformOAuthConfigured } from '@/services/youtubeConnection';
import { blobAccess, storageConfigured } from '@/lib/storage';

/** Operator dashboard: health of the platform across all workspaces. */
export async function GET() {
  try {
    await requirePlatformAdmin();
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [users, workspaces, subs, jobGroups, failedJobs, usage, lastWorkerActivity, audit, newUsers] = await Promise.all([
      prisma.user.count(),
      prisma.workspace.count(),
      prisma.subscription.groupBy({ by: ['status', 'planId'], _count: true }),
      prisma.job.groupBy({ by: ['type', 'status'], _count: true, where: { createdAt: { gte: dayAgo } } }),
      prisma.job.findMany({
        where: { status: 'failed' },
        orderBy: { updatedAt: 'desc' },
        take: 20,
        select: { id: true, type: true, error: true, attempts: true, workspaceId: true, projectId: true, clipId: true, updatedAt: true },
      }),
      prisma.usageEntry.groupBy({ by: ['metric'], _sum: { amount: true }, where: { status: 'committed', createdAt: { gte: monthStart } } }),
      prisma.job.findFirst({ where: { type: { in: ['transcribe', 'render'] }, startedAt: { not: null } }, orderBy: { startedAt: 'desc' }, select: { startedAt: true } }),
      prisma.auditEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 30, select: { action: true, workspaceId: true, userId: true, detail: true, createdAt: true } }),
      prisma.user.count({ where: { createdAt: { gte: dayAgo } } }),
    ]);

    const queue = await prisma.job.groupBy({ by: ['type', 'status'], _count: true, where: { status: { in: ['queued', 'running'] } } });
    const oldestQueued = await prisma.job.findFirst({ where: { status: 'queued' }, orderBy: { createdAt: 'asc' }, select: { createdAt: true, type: true } });

    return NextResponse.json({
      success: true,
      config: {
        worker: workerConfigured(),
        billing: billingConfigured(),
        email: emailConfigured(),
        ai: aiConfigured(),
        youtubeOAuth: platformOAuthConfigured(),
        youtubeDataApi: Boolean(process.env.YOUTUBE_API_KEY),
        storage: storageConfigured() ? blobAccess() : 'not configured',
        encryptionKey: Boolean(process.env.ENCRYPTION_KEY),
        cronSecret: Boolean(process.env.CRON_SECRET),
      },
      totals: { users, newUsers24h: newUsers, workspaces },
      subscriptions: subs.map((s) => ({ status: s.status, plan: s.planId, count: s._count })),
      jobs24h: jobGroups.map((g) => ({ type: g.type, status: g.status, count: g._count })),
      queue: queue.map((g) => ({ type: g.type, status: g.status, count: g._count })),
      oldestQueued,
      lastWorkerActivity: lastWorkerActivity?.startedAt ?? null,
      failedJobs,
      usageThisMonth: {
        sourceMinutes: Math.round((usage.find((u) => u.metric === 'source_seconds')?._sum.amount || 0) / 60),
        exports: usage.find((u) => u.metric === 'exports')?._sum.amount || 0,
      },
      audit,
    });
  } catch (error) {
    return errorResponse(error, 'Could not load the overview.', 'api/admin/overview');
  }
}
