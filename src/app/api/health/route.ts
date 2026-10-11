import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/** Liveness + database reachability, for uptime monitors. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
