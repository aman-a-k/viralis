import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { consumeToken } from '@/lib/authTokens';
import { audit } from '@/lib/workspace';
import { clientIp } from '@/lib/http';

export async function POST(req: Request) {
  const { token, password } = await req.json().catch(() => ({}));
  if (typeof password !== 'string' || password.length < 10 || password.length > 200) {
    return NextResponse.json({ success: false, error: 'Use a password of at least 10 characters.' }, { status: 400 });
  }
  const userId = await consumeToken(String(token || ''), 'reset_password');
  if (!userId) {
    return NextResponse.json({ success: false, error: 'This reset link is invalid or has expired. Request a new one.' }, { status: 400 });
  }
  // Following the emailed link proves ownership of the address.
  const user = await prisma.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(password, 12), emailVerified: new Date() } });
  if (user.email) await prisma.loginAttempt.deleteMany({ where: { key: `email:${user.email}`, success: false } }).catch(() => {});
  await audit({ userId }, 'account.password_reset', undefined, clientIp(req));
  return NextResponse.json({ success: true });
}
