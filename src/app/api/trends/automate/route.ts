import { NextResponse } from 'next/server';
import { requireWorkspace } from '@/lib/workspace';
import { errorResponse, HttpError } from '@/lib/http';
import { runAutomaticDiscovery } from '@/services/automationService';
import { normalizeConfig, clampClipCount, projectView } from '@/services/pipeline';
import { MissingYouTubeKeyError } from '@/services/youtubeTrending';

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const ctx = await requireWorkspace({ verified: true });
    const body = await req.json().catch(() => ({}));
    const result = await runAutomaticDiscovery(
      { workspaceId: ctx.workspaceId, userId: ctx.userId, unlimited: ctx.isPlatformAdmin },
      {
        ...normalizeConfig(body),
        clipCount: clampClipCount(body.clipCount),
        region: typeof body.region === 'string' ? body.region : undefined,
        category: typeof body.category === 'string' ? body.category : undefined,
        rightsConfirmed: body.rightsConfirmed === true,
      }
    );
    return NextResponse.json({
      success: true,
      video: result.video,
      project: await projectView(ctx.workspaceId, result.projectId),
      message: `Picked "${result.video.title}". Clips will appear in your review queue when they're ready.`,
    });
  } catch (error) {
    if (error instanceof MissingYouTubeKeyError) return errorResponse(new HttpError(503, error.message));
    return errorResponse(error, 'The automatic run failed. Try again.', 'api/trends/automate');
  }
}
