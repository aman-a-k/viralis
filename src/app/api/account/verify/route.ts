import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { consumeToken } from '@/lib/authTokens';
import { appUrl } from '@/lib/email';

/** The link in the verification email. */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('token') || '';
  const userId = await consumeToken(token, 'verify_email');
  if (!userId) return NextResponse.redirect(`${appUrl()}/?verify=invalid`);
  await prisma.user.update({ where: { id: userId }, data: { emailVerified: new Date() } });
  return NextResponse.redirect(`${appUrl()}/?verify=ok`);
}
