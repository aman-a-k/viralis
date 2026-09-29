import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/apiAuth';
import { publishClipToYouTube, YouTubeNotConnectedError, type Privacy } from '@/services/youtubePublisher';

// Streams the rendered clip to YouTube; allow up to the Hobby-plan max.
export const maxDuration = 60;

const PRIVACIES: Privacy[] = ['public', 'unlisted', 'private'];

export async function POST(req: Request) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  try {
    const { clipId, privacy = 'unlisted' } = await req.json();
    if (typeof clipId !== 'string' || !clipId) {
      return NextResponse.json({ success: false, error: 'clipId is required' }, { status: 400 });
    }
    if (!PRIVACIES.includes(privacy)) {
      return NextResponse.json({ success: false, error: 'Invalid privacy setting.' }, { status: 400 });
    }

    const record = await publishClipToYouTube(clipId, privacy);
    return NextResponse.json({ success: true, postUrl: record.postUrl, message: 'Published to YouTube.' });
  } catch (error) {
    console.error('[API /api/repurpose/publish]', error);
    const status = error instanceof YouTubeNotConnectedError ? 424 : 500;
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Publishing failed.' },
      { status }
    );
  }
}
