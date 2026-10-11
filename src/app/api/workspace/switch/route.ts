import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireWorkspace, WORKSPACE_COOKIE } from '@/lib/workspace';
import { errorResponse, notFound } from '@/lib/http';

export async function POST(req: Request) {
  try {
    const ctx = await requireWorkspace();
    const { workspaceId } = await req.json().catch(() => ({}));
    const m = await prisma.membership.findFirst({ where: { userId: ctx.userId, workspaceId: String(workspaceId || '') } });
    if (!m) throw notFound('Workspace not found.');
    const res = NextResponse.json({ success: true });
    res.cookies.set(WORKSPACE_COOKIE, m.workspaceId, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 365 * 24 * 60 * 60 });
    return res;
  } catch (error) {
    return errorResponse(error, 'Could not switch workspace.', 'api/workspace/switch');
  }
}
