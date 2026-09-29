import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { syncYouTubeMetrics } from '@/services/youtubeStats';

export const maxDuration = 60;

// Called daily by Vercel Cron (see vercel.json). Vercel sends
// `Authorization: Bearer $CRON_SECRET`; anything else is rejected, so this
// can't be triggered from the open internet.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const given = req.headers.get('authorization') || '';
  const expected = `Bearer ${secret}`;
  const ok =
    !!secret &&
    given.length === expected.length &&
    timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  if (!ok) return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });

  try {
    const result = await syncYouTubeMetrics();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    // Not connected yet / access revoked: nothing to sync, not a server fault.
    console.warn('[cron sync-metrics]', error instanceof Error ? error.message : error);
    return NextResponse.json({ success: true, skipped: true });
  }
}
