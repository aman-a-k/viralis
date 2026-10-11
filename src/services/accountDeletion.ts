import { prisma } from '../lib/prisma';
import { deleteMedia } from '../lib/storage';
import { cancelJobs } from '../lib/jobs';
import { ENTITLED_STATUSES } from '../lib/plans';
import { cancelSubscription, billingConfigured } from './billing';
import { disconnect } from './youtubeConnection';

/** Deletes a workspace and everything in it: media, channel grant, subscription, records. */
export async function deleteWorkspace(workspaceId: string) {
  await cancelJobs({ workspaceId });
  const sub = await prisma.subscription.findUnique({ where: { workspaceId } });
  if (sub && billingConfigured() && (ENTITLED_STATUSES.has(sub.status) || ['created', 'authenticated'].includes(sub.status))) {
    await cancelSubscription(workspaceId, true).catch((err) => console.error('[delete] subscription cancel failed', err));
  }
  await disconnect(workspaceId).catch(() => {});

  const [projects, clips] = await Promise.all([
    prisma.project.findMany({ where: { workspaceId }, select: { sourceBlobPath: true, sourceVideoUrl: true, sourceType: true } }),
    prisma.clip.findMany({ where: { workspaceId }, select: { renderBlobPath: true, videoUrl: true } }),
  ]);
  await deleteMedia([
    ...projects.flatMap((p) => [p.sourceBlobPath, p.sourceType === 'upload' ? p.sourceVideoUrl : null]),
    ...clips.flatMap((c) => [c.renderBlobPath, c.videoUrl]),
  ]);
  await prisma.workspace.delete({ where: { id: workspaceId } });
}

/**
 * Deletes a user. Workspaces they solely own are deleted with them; in
 * shared workspaces they're removed and ownership passes to the next admin
 * (or member) so the workspace isn't orphaned.
 */
export async function deleteAccount(userId: string) {
  const memberships = await prisma.membership.findMany({ where: { userId } });
  for (const m of memberships) {
    const others = await prisma.membership.findMany({
      where: { workspaceId: m.workspaceId, userId: { not: userId } },
      orderBy: { createdAt: 'asc' },
    });
    if (others.length === 0) {
      await deleteWorkspace(m.workspaceId);
      continue;
    }
    if (m.role === 'owner' && !others.some((o) => o.role === 'owner')) {
      const heir = others.find((o) => o.role === 'admin') || others[0];
      await prisma.membership.update({ where: { id: heir.id }, data: { role: 'owner' } });
    }
  }
  await prisma.authToken.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } });
}
