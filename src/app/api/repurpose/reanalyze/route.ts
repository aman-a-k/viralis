import { NextResponse } from 'next/server';
import { requireWorkspace } from '@/lib/workspace';
import { errorResponse } from '@/lib/http';
import { reanalyzeProject, normalizeConfig, clampClipCount, projectView } from '@/services/pipeline';

export async function POST(req: Request) {
  try {
    const ctx = await requireWorkspace({ verified: true });
    const body = await req.json().catch(() => ({}));
    await reanalyzeProject(
      { workspaceId: ctx.workspaceId, userId: ctx.userId, unlimited: ctx.isPlatformAdmin },
      String(body.projectId || ''),
      clampClipCount(body.clipCount),
      normalizeConfig(body)
    );
    return NextResponse.json({ success: true, project: await projectView(ctx.workspaceId, String(body.projectId)) });
  } catch (error) {
    return errorResponse(error, 'Could not re-analyze this project.', 'api/repurpose/reanalyze');
  }
}
