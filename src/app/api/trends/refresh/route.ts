import { NextResponse } from 'next/server';
import { requireWorkspace } from '@/lib/workspace';
import { errorResponse, HttpError } from '@/lib/http';
import { refreshTrendRadar } from '@/services/googleTrends';

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const ctx = await requireWorkspace();
    const body = await req.json().catch(() => ({}));
    const result = await refreshTrendRadar(ctx.workspaceId, { geo: typeof body.region === 'string' ? body.region : undefined });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof Error && /Google Trends/.test(error.message)) return errorResponse(new HttpError(502, error.message));
    return errorResponse(error, 'Could not refresh trends.', 'api/trends/refresh');
  }
}
