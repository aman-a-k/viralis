import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hitRateLimit } from '@/lib/rateLimit';
import { clientIp } from '@/lib/http';
import { sendPasswordResetEmail } from '@/lib/authTokens';

/** Always answers the same way, so it can't be used to discover which emails have accounts. */
export async function POST(req: Request) {
  const generic = NextResponse.json({ success: true, message: 'If an account exists for that email, a reset link is on its way.' });
  try {
    const { email } = await req.json().catch(() => ({}));
    if (typeof email !== 'string' || !email.includes('@')) return generic;
    const normalized = email.toLowerCase().trim();
    if (await hitRateLimit(`reset:${clientIp(req)}`, 10)) return generic;
    if (await hitRateLimit(`reset:${normalized}`, 3)) return generic;
    const user = await prisma.user.findUnique({ where: { email: normalized } });
    if (user?.email) await sendPasswordResetEmail({ id: user.id, email: user.email });
  } catch (err) {
    console.error('[password forgot]', err);
  }
  return generic;
}
