import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireWorkspace, audit, WORKSPACE_COOKIE } from '@/lib/workspace';
import { errorResponse, badRequest } from '@/lib/http';
import { sha256 } from '@/lib/crypto';

/** Joins the workspace an invite is for. The signed-in email must match the invited one. */
export async function POST(req: Request) {
  try {
    const ctx = await requireWorkspace();
    const { token } = await req.json().catch(() => ({}));
    const invite = await prisma.invite.findUnique({ where: { tokenHash: sha256(String(token || '')) } });
    if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) throw badRequest('This invite is invalid or has expired. Ask for a new one.');
    if (!ctx.email || ctx.email.toLowerCase() !== invite.email) {
      throw badRequest(`This invite was sent to ${invite.email}. Sign in with that email to accept it.`);
    }
    await prisma.$transaction([
      prisma.membership.upsert({
        where: { workspaceId_userId: { workspaceId: invite.workspaceId, userId: ctx.userId } },
        update: {},
        create: { workspaceId: invite.workspaceId, userId: ctx.userId, role: invite.role },
      }),
      prisma.invite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } }),
      // Accepting an emailed invite proves the address.
      prisma.user.update({ where: { id: ctx.userId }, data: { emailVerified: new Date() } }),
    ]);
    await audit({ workspaceId: invite.workspaceId, userId: ctx.userId }, 'member.join', { inviteId: invite.id });
    const res = NextResponse.json({ success: true });
    res.cookies.set(WORKSPACE_COOKIE, invite.workspaceId, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 365 * 24 * 60 * 60 });
    return res;
  } catch (error) {
    return errorResponse(error, 'Could not accept the invite.', 'api/invites/accept');
  }
}
