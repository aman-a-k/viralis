import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/apiAuth';

/**
 * Frame rendering (cut / reframe / burn subtitles) runs on the media worker,
 * which is not part of this deployment. The analyzer produces exact timestamps
 * and platform copy; rendering is a separate follow-up.
 */
export async function POST() {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  return NextResponse.json(
    {
      success: false,
      error:
        'Clip rendering runs on the media worker, which is not enabled on this deployment. Use the timestamps + captions to cut the clip.',
    },
    { status: 501 }
  );
}
