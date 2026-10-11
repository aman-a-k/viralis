import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/apiAuth';
import { refreshTrendRadar } from '@/services/googleTrends';

export const maxDuration = 60;

export async function POST(req: Request) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json().catch(() => ({}));
    const result = await refreshTrendRadar({ geo: typeof body.region === 'string' ? body.region : undefined });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('[API /api/trends/refresh]', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Could not refresh trends.' },
      { status: 502 }
    );
  }
}
