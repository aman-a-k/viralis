import { NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { requireSession } from '@/lib/apiAuth';

const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;

// Issues short-lived tokens so the browser can upload a video straight to
// Vercel Blob — serverless request bodies are capped at 4.5MB, far too small
// for video. Only signed-in users get a token, and only for media files.
export async function POST(req: Request) {
  const body = (await req.json()) as HandleUploadBody;

  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => {
        const auth = await requireSession();
        if (auth instanceof NextResponse) throw new Error('Authentication required.');
        return {
          allowedContentTypes: ['video/*', 'audio/*'],
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          addRandomSuffix: true,
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
