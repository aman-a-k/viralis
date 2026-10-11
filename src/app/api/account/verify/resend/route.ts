import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireWorkspace } from '@/lib/workspace';
import { errorResponse, HttpError } from '@/lib/http';
import { hitRateLimit } from '@/lib/rateLimit';
import { sendVerificationEmail } from '@/lib/authTokens';

export async function POST() {
  try {
    const ctx = await requireWorkspace();
    if (ctx.emailVerified) return NextResponse.json({ success: true, message: 'Your email is already confirmed.' });
    if (await hitRateLimit(`verify:${ctx.userId}`, 5, 60 * 60 * 1000)) throw new HttpError(429, 'Too many requests. Try again in an hour.');
    const user = await prisma.user.findUnique({ where: { id: ctx.userId } });
    if (!user?.email) throw new HttpError(400, 'Your account has no email address.');
    await sendVerificationEmail({ id: user.id, email: user.email, name: user.name });
    return NextResponse.json({ success: true, message: `Sent — check ${user.email}.` });
  } catch (error) {
    return errorResponse(error, 'Could not send the email. Try again later.', 'api/account/verify/resend');
  }
}
