import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireWorkspace } from '@/lib/workspace';
import { errorResponse } from '@/lib/http';
import { getEntitlement, getUsage } from '@/lib/usage';
import { serializeProject } from '@/services/pipeline';
import { getConnection, platformOAuthConfigured } from '@/services/youtubeConnection';
import { emailConfigured } from '@/lib/email';
import { billingConfigured } from '@/services/billing';

export async function GET() {
  try {
    const ctx = await requireWorkspace();
    const ws = ctx.workspaceId;

    const [settings, trends, approvalQueue, projects, counts, connection, workspace] = await Promise.all([
      prisma.settings.findUnique({ where: { workspaceId: ws } }),
      prisma.trend.findMany({ where: { workspaceId: ws }, orderBy: { createdAt: 'desc' }, take: 30 }),
      prisma.approvalQueue.findMany({ where: { workspaceId: ws, status: 'pending' }, orderBy: { createdAt: 'desc' }, take: 100 }),
      // Transcripts (often 100KB+) are never needed by the dashboard.
      prisma.project.findMany({
        where: { workspaceId: ws },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          clips: { orderBy: { startTime: 'asc' }, include: { schedules: { where: { platform: 'youtube' }, orderBy: { createdAt: 'desc' }, take: 1 } } },
          jobs: { where: { status: { in: ['queued', 'running'] } }, orderBy: { createdAt: 'desc' }, take: 1 },
        },
      }),
      Promise.all([
        prisma.clip.count({ where: { workspaceId: ws } }),
        prisma.clip.count({ where: { workspaceId: ws, OR: [{ renderBlobPath: { not: null } }, { videoUrl: { not: null } }] } }),
        prisma.schedule.count({ where: { workspaceId: ws, status: 'published' } }),
        prisma.project.count({ where: { workspaceId: ws } }),
      ]),
      getConnection(ws),
      prisma.workspace.findUnique({ where: { id: ws }, select: { name: true, retentionDays: true } }),
    ]);

    const ent = await getEntitlement(ws, { unlimited: ctx.isPlatformAdmin });
    const used = await getUsage(ws, ent);

    // Average of each clip's latest snapshot (not every historical snapshot).
    const watch = await prisma.$queryRaw<{ avg: number | null }[]>`
      SELECT AVG(w) AS avg FROM (
        SELECT DISTINCT ON ("clipId", "platform") "watchThroughPct" AS w
        FROM "Metric" WHERE "workspaceId" = ${ws} AND "clipId" IS NOT NULL
        ORDER BY "clipId", "platform", "fetchedAt" DESC
      ) latest WHERE w IS NOT NULL`;
    const avgWatch = watch[0]?.avg;

    const [clipsFound, clipsExported, clipsPublished, projectCount] = counts;

    return NextResponse.json({
      success: true,
      data: {
        user: { email: ctx.email, emailVerified: ctx.emailVerified, role: ctx.role, isPlatformAdmin: ctx.isPlatformAdmin },
        workspace: { id: ws, name: workspace?.name || ctx.workspaceName, retentionDays: workspace?.retentionDays ?? 30 },
        projects: projects.map(serializeProject),
        stats: {
          projects: projectCount,
          clipsFound,
          clipsExported,
          clipsPublished,
          avgWatchThrough: avgWatch !== null && avgWatch !== undefined ? Math.round(Number(avgWatch)) : null,
        },
        plan: {
          id: ent.plan.id,
          name: ent.plan.name,
          source: ent.source,
          periodEnd: ent.periodEnd,
          status: ent.subscriptionStatus,
          cancelAtPeriodEnd: ent.cancelAtPeriodEnd,
          maxSourceMinutes: ent.plan.maxSourceMinutes,
          maxUploadMb: ent.plan.maxUploadMb,
          limits: { sourceMinutes: Math.floor(ent.limits.source_seconds / 60), exports: ent.limits.exports },
          used: { sourceMinutes: Math.ceil(used.source_seconds / 60), exports: used.exports },
        },
        channel: connection
          ? { connected: connection.status === 'active', title: connection.title, status: connection.status, lastError: connection.lastError, legacy: !!connection.legacyClientId }
          : { connected: false },
        capabilities: {
          youtubeConnect: platformOAuthConfigured(),
          billing: billingConfigured(),
          email: emailConfigured(),
        },
        settings: {
          brandName: settings?.brandName || '',
          brandNiche: settings?.brandNiche || '',
          brandTone: settings?.brandTone || '',
          targetAudience: settings?.targetAudience || '',
          captionStyle: settings?.captionStyle || 'Dynamic Pop',
          defaultLanguage: settings?.defaultLanguage || 'auto',
          defaultPlatforms: safeArray(settings?.defaultPlatforms, ['instagram', 'youtube', 'tiktok']),
          defaultOrientations: safeArray(settings?.defaultOrientations, ['9:16', '1:1', '16:9']),
        },
        trends,
        approvalQueue,
      },
    });
  } catch (error) {
    return errorResponse(error, 'Could not load your workspace.', 'api/data');
  }
}

function safeArray(json: string | null | undefined, fallback: string[]): string[] {
  try {
    const v = JSON.parse(json || '');
    return Array.isArray(v) && v.length ? v : fallback;
  } catch {
    return fallback;
  }
}
