import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireWorkspace, audit } from '@/lib/workspace';
import { errorResponse, badRequest, forbidden, notFound } from '@/lib/http';
import { randomToken, sha256 } from '@/lib/crypto';
import { appUrl, sendEmail, escapeHtml } from '@/lib/email';

const ROLES = ['admin', 'member'];

export async function GET() {
  try {
    const ctx = await requireWorkspace();
    const [members, invites, workspaces] = await Promise.all([
      prisma.membership.findMany({
        where: { workspaceId: ctx.workspaceId },
        include: { user: { select: { email: true, name: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      ctx.role === 'member' ? [] : prisma.invite.findMany({ where: { workspaceId: ctx.workspaceId, acceptedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' } }),
      prisma.membership.findMany({ where: { userId: ctx.userId }, include: { workspace: { select: { id: true, name: true } } } }),
    ]);
    return NextResponse.json({
      success: true,
      role: ctx.role,
      currentWorkspaceId: ctx.workspaceId,
      workspaces: workspaces.map((w) => ({ id: w.workspace.id, name: w.workspace.name, role: w.role })),
      members: members.map((m) => ({ id: m.id, email: m.user.email, name: m.user.name, role: m.role, you: m.userId === ctx.userId })),
      invites: invites.map((i) => ({ id: i.id, email: i.email, role: i.role, expiresAt: i.expiresAt })),
    });
  } catch (error) {
    return errorResponse(error, 'Could not load members.', 'api/workspace/members GET');
  }
}

/** Invite someone by email (admins). */
export async function POST(req: Request) {
  try {
    const ctx = await requireWorkspace({ role: 'admin', verified: true });
    const { email, role = 'member' } = await req.json().catch(() => ({}));
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw badRequest('Enter a valid email address.');
    if (!ROLES.includes(role)) throw badRequest('Choose a role.');
    if (role === 'admin' && ctx.role !== 'owner') throw forbidden('Only the owner can invite admins.');
    const normalized = email.toLowerCase().trim();

    const already = await prisma.membership.findFirst({ where: { workspaceId: ctx.workspaceId, user: { email: normalized } } });
    if (already) throw badRequest('That person is already in this workspace.');
    const pending = await prisma.invite.count({ where: { workspaceId: ctx.workspaceId, acceptedAt: null, expiresAt: { gt: new Date() } } });
    if (pending >= 20) throw badRequest('Too many pending invites. Revoke some first.');

    const token = randomToken();
    await prisma.invite.create({
      data: { workspaceId: ctx.workspaceId, email: normalized, role, tokenHash: sha256(token), invitedById: ctx.userId, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
    });
    await sendEmail(
      normalized,
      `You're invited to ${ctx.workspaceName} on Viralis`,
      `Join ${ctx.workspaceName}`,
      `<p>${escapeHtml(ctx.email || 'A teammate')} invited you to collaborate in <strong>${escapeHtml(ctx.workspaceName)}</strong> on Viralis. The invite works for 7 days.</p>`,
      { label: 'Accept invite', url: `${appUrl()}/invite?token=${encodeURIComponent(token)}` }
    );
    await audit(ctx, 'member.invite', { email: normalized, role });
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, 'Could not send the invite.', 'api/workspace/members POST');
  }
}

/** Change a member's role (owner only). */
export async function PATCH(req: Request) {
  try {
    const ctx = await requireWorkspace({ role: 'owner' });
    const { membershipId, role } = await req.json().catch(() => ({}));
    if (!ROLES.includes(role)) throw badRequest('Choose a role.');
    const m = await prisma.membership.findFirst({ where: { id: String(membershipId || ''), workspaceId: ctx.workspaceId } });
    if (!m) throw notFound('Member not found.');
    if (m.role === 'owner') throw badRequest('The owner’s role can’t be changed.');
    await prisma.membership.update({ where: { id: m.id }, data: { role } });
    await audit(ctx, 'member.role', { membershipId: m.id, role });
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, 'Could not change the role.', 'api/workspace/members PATCH');
  }
}

/** Remove a member or revoke an invite (admins), or leave (anyone but the owner). */
export async function DELETE(req: Request) {
  try {
    const ctx = await requireWorkspace();
    const { membershipId, inviteId } = await req.json().catch(() => ({}));
    if (inviteId) {
      if (ctx.role === 'member') throw forbidden();
      await prisma.invite.deleteMany({ where: { id: String(inviteId), workspaceId: ctx.workspaceId } });
      return NextResponse.json({ success: true });
    }
    const m = await prisma.membership.findFirst({ where: { id: String(membershipId || ''), workspaceId: ctx.workspaceId } });
    if (!m) throw notFound('Member not found.');
    if (m.role === 'owner') throw badRequest('The owner can’t be removed. Delete the account or workspace instead.');
    if (m.userId !== ctx.userId && ctx.role === 'member') throw forbidden();
    if (m.role === 'admin' && m.userId !== ctx.userId && ctx.role !== 'owner') throw forbidden('Only the owner can remove admins.');
    await prisma.membership.delete({ where: { id: m.id } });
    await audit(ctx, m.userId === ctx.userId ? 'member.leave' : 'member.remove', { membershipId: m.id });
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, 'Could not remove the member.', 'api/workspace/members DELETE');
  }
}
