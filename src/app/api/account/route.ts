import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { requireWorkspace, audit } from '@/lib/workspace';
import { errorResponse, badRequest } from '@/lib/http';
import { deleteAccount } from '@/services/accountDeletion';

export const maxDuration = 60;

/**
 * Permanently deletes the signed-in account. Requires typing DELETE (and the
 * password, for password accounts). Workspaces owned solely by this user —
 * with their recordings, clips and subscription — are deleted too.
 */
export async function DELETE(req: Request) {
  try {
    const ctx = await requireWorkspace();
    const { confirm, password } = await req.json().catch(() => ({}));
    if (confirm !== 'DELETE') throw badRequest('Type DELETE to confirm.');
    const user = await prisma.user.findUnique({ where: { id: ctx.userId } });
    if (user?.passwordHash && !(typeof password === 'string' && (await bcrypt.compare(password, user.passwordHash)))) {
      throw badRequest('Your password is incorrect.');
    }
    await audit({ userId: ctx.userId }, 'account.delete', { email: user?.email });
    await deleteAccount(ctx.userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, 'Could not delete your account. Contact support.', 'api/account DELETE');
  }
}
