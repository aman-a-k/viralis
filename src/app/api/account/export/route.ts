import { prisma } from '@/lib/prisma';
import { requireWorkspace } from '@/lib/workspace';
import { errorResponse } from '@/lib/http';

/** Downloads the workspace's data (projects, clips, captions, publish history) as JSON. */
export async function GET() {
  try {
    const ctx = await requireWorkspace();
    const [user, workspace, projects, settings] = await Promise.all([
      prisma.user.findUnique({ where: { id: ctx.userId }, select: { email: true, name: true, createdAt: true } }),
      prisma.workspace.findUnique({ where: { id: ctx.workspaceId }, select: { name: true, createdAt: true } }),
      prisma.project.findMany({
        where: { workspaceId: ctx.workspaceId },
        select: {
          title: true, sourceType: true, sourceVideoUrl: true, transcript: true, duration: true, language: true, createdAt: true,
          clips: {
            select: {
              title: true, startTime: true, endTime: true, status: true, transcriptSegment: true, captionVersions: true,
              publishTitle: true, publishDescription: true, createdAt: true,
              schedules: { select: { platform: true, status: true, postUrl: true, publishedTime: true } },
            },
          },
        },
      }),
      prisma.settings.findUnique({
        where: { workspaceId: ctx.workspaceId },
        select: { brandName: true, brandNiche: true, brandTone: true, targetAudience: true, captionStyle: true, defaultLanguage: true },
      }),
    ]);
    const body = JSON.stringify({ exportedAt: new Date().toISOString(), user, workspace, settings, projects }, null, 2);
    return new Response(body, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': 'attachment; filename="viralis-export.json"',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    return errorResponse(error, 'Could not export your data.', 'api/account/export');
  }
}
