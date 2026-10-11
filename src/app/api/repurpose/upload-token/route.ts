import { NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { requireWorkspace } from '@/lib/workspace';
import { getEntitlement } from '@/lib/usage';
import { sourcePathPrefix } from '@/lib/storage';

// Issues a short-lived token so the browser uploads the recording straight to
// Blob storage (serverless request bodies are capped at 4.5MB). The token is
// only valid for this workspace's own sources/ folder and the plan's size cap.
export async function POST(req: Request) {
  const body = (await req.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        const ctx = await requireWorkspace({ verified: true });
        if (!pathname.startsWith(sourcePathPrefix(ctx.workspaceId))) {
          throw new Error('Uploads must go to your own workspace.');
        }
        const ent = await getEntitlement(ctx.workspaceId, { unlimited: ctx.isPlatformAdmin });
        if (ent.source === 'none') throw new Error('Choose a plan to upload recordings.');
        return {
          allowedContentTypes: ['video/*', 'audio/*'],
          maximumSizeInBytes: ent.plan.maxUploadMb * 1024 * 1024,
          addRandomSuffix: true,
          validUntil: Date.now() + 60 * 60 * 1000,
        };
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload not allowed.' },
      { status: 400 }
    );
  }
}
