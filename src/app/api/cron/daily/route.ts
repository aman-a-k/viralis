import { NextResponse } from 'next/server';
import { safeEqual } from '@/lib/crypto';
import { runDailyMaintenance } from '@/services/maintenance';

export const maxDuration = 300;

// Called daily by Vercel Cron (see vercel.json), which sends
// `Authorization: Bearer $CRON_SECRET`; anything else is rejected.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !safeEqual(req.headers.get('authorization') || '', `Bearer ${secret}`)) {
    return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
  }
  const result = await runDailyMaintenance();
  return NextResponse.json({ success: true, ...result });
}
