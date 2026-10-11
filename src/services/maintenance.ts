import { prisma } from '../lib/prisma';
import { deleteMedia } from '../lib/storage';
import { releaseUsage } from '../lib/usage';
import { PLANS } from '../lib/plans';
import { getEntitlement } from '../lib/usage';
import { isPlatformAdminEmail } from '../lib/workspace';
import { pruneLoginAttempts } from '../lib/rateLimit';
import { sweepAbandonedJobs, runAnalysisSlice } from './pipeline';
import { syncAllWorkspaces } from './youtubeStats';
import { reconcileSubscriptions } from './billing';

/** Reservations whose work is no longer pending (e.g. the request died mid-way). */
async function releaseStaleReservations() {
  const stale = await prisma.usageEntry.findMany({
    where: { status: 'reserved', createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });
  let released = 0;
  for (const entry of stale) {
    const ref = entry.refId
      ? entry.refType === 'clip'
        ? { clipId: entry.refId }
        : { projectId: entry.refId }
      : null;
    const active = ref ? await prisma.job.count({ where: { status: { in: ['queued', 'running'] }, ...ref } }) : 0;
    if (!active) {
      await releaseUsage(entry.id, 'stale reservation');
      released += 1;
    }
  }
  return released;
}

/**
 * Deletes stored media older than the workspace's retention period (capped
 * by its plan's). Project and clip records — titles, transcripts, captions,
 * publish history — are kept; only the video files go.
 */
async function enforceRetention() {
  const workspaces = await prisma.workspace.findMany({
    select: { id: true, retentionDays: true, memberships: { where: { role: 'owner' }, select: { user: { select: { email: true } } } } },
  });
  let filesDeleted = 0;
  for (const ws of workspaces) {
    const internal = ws.memberships.some((m) => isPlatformAdminEmail(m.user.email));
    const ent = internal ? null : await getEntitlement(ws.id);
    const planDays = ent ? (ent.source === 'none' ? PLANS.trial.retentionDays : ent.plan.retentionDays) : ws.retentionDays;
    const days = Math.min(ws.retentionDays, planDays);
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const projects = await prisma.project.findMany({
      where: { workspaceId: ws.id, createdAt: { lt: cutoff }, sourceBlobPath: { not: null }, status: { notIn: ['transcribing', 'analyzing'] } },
      select: { id: true, sourceBlobPath: true },
    });
    const clips = await prisma.clip.findMany({
      where: { workspaceId: ws.id, updatedAt: { lt: cutoff }, renderBlobPath: { not: null }, renderStatus: { notIn: ['queued', 'rendering'] } },
      select: { id: true, renderBlobPath: true },
    });
    if (!projects.length && !clips.length) continue;
    await deleteMedia([...projects.map((p) => p.sourceBlobPath), ...clips.map((c) => c.renderBlobPath)]);
    await prisma.project.updateMany({ where: { id: { in: projects.map((p) => p.id) } }, data: { sourceBlobPath: null } });
    await prisma.clip.updateMany({ where: { id: { in: clips.map((c) => c.id) } }, data: { renderBlobPath: null, renderStatus: 'expired' } });
    filesDeleted += projects.length + clips.length;
  }
  return filesDeleted;
}

async function pruneRecords() {
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  await Promise.all([
    pruneLoginAttempts(),
    prisma.authToken.deleteMany({ where: { OR: [{ expiresAt: { lt: new Date() } }, { usedAt: { lt: monthAgo } }] } }),
    prisma.job.deleteMany({ where: { status: { in: ['succeeded', 'canceled'] }, updatedAt: { lt: monthAgo } } }),
    prisma.invite.deleteMany({ where: { expiresAt: { lt: monthAgo } } }),
  ]);
}

export async function runDailyMaintenance() {
  const out: Record<string, unknown> = {};
  const step = async (name: string, fn: () => Promise<unknown>) => {
    try {
      out[name] = await fn();
    } catch (err) {
      console.error(`[maintenance] ${name} failed`, err);
      out[name] = 'error';
    }
  };
  await step('abandonedJobs', sweepAbandonedJobs);
  await step('analysis', async () => {
    let n = 0;
    while (n < 5 && (await runAnalysisSlice({ budgetMs: 25_000 }))) n++;
    return n;
  });
  await step('staleReservations', releaseStaleReservations);
  await step('retentionFilesDeleted', enforceRetention);
  await step('subscriptionsReconciled', reconcileSubscriptions);
  await step('workspacesSynced', syncAllWorkspaces);
  await step('pruned', pruneRecords);
  return out;
}
