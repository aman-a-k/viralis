import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { requireWorkspace, audit } from '@/lib/workspace';
import { errorResponse, badRequest } from '@/lib/http';

export async function POST(req: Request) {
  try {
    const ctx = await requireWorkspace();
    const { current, next } = await req.json().catch(() => ({}));
    if (typeof next !== 'string' || next.length < 10 || next.length > 200) throw badRequest('Use a password of at least 10 characters.');
    const user = await prisma.user.findUnique({ where: { id: ctx.userId } });
    if (user?.passwordHash && !(typeof current === 'string' && (await bcrypt.compare(current, user.passwordHash)))) {
      throw badRequest('Your current password is incorrect.');
    }
    await prisma.user.update({ where: { id: ctx.userId }, data: { passwordHash: await bcrypt.hash(next, 12) } });
    await audit(ctx, 'account.password_change');
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, 'Could not change your password.', 'api/account/password/change');
  }
}
