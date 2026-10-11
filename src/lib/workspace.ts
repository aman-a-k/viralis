import { getServerSession } from 'next-auth';
import { cookies } from 'next/headers';
import { authOptions } from './auth';
import { prisma } from './prisma';
import { HttpError, forbidden } from './http';
import { emailConfigured } from './email';

export type Role = 'owner' | 'admin' | 'member';
const RANK: Record<Role, number> = { member: 1, admin: 2, owner: 3 };

export const WORKSPACE_COOKIE = 'vx_ws';

export interface WorkspaceContext {
  userId: string;
  email: string | null;
  emailVerified: boolean;
  workspaceId: string;
  workspaceName: string;
  role: Role;
  isPlatformAdmin: boolean;
}

export function isPlatformAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const admins = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.toLowerCase());
}

/**
 * Every new account gets its own workspace (owner role) with default
 * settings. Safe to call repeatedly: returns the existing first membership.
 */
export async function ensurePersonalWorkspace(userId: string, displayName?: string | null) {
  const existing = await prisma.membership.findFirst({ where: { userId }, orderBy: { createdAt: 'asc' } });
  if (existing) return existing.workspaceId;

  // Data from before workspaces existed lives in 'ws_legacy'. If no account
  // existed at upgrade time it has no members; the first platform admin to
  // sign up becomes its owner instead of starting from an empty workspace.
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (isPlatformAdminEmail(user?.email)) {
    const legacy = await prisma.workspace.findUnique({ where: { id: 'ws_legacy' }, select: { id: true, _count: { select: { memberships: true } } } });
    if (legacy && legacy._count.memberships === 0) {
      await prisma.membership.create({ data: { workspaceId: legacy.id, userId, role: 'owner' } });
      await prisma.settings.upsert({ where: { workspaceId: legacy.id }, update: {}, create: { workspaceId: legacy.id } });
      return legacy.id;
    }
  }

  const name = displayName?.trim() ? `${displayName.trim().split(/\s+/)[0]}'s workspace` : 'My workspace';
  const ws = await prisma.workspace.create({
    data: {
      name: name.slice(0, 80),
      trialGranted: true,
      memberships: { create: { userId, role: 'owner' } },
      settings: { create: { brandName: displayName?.trim() || null, brandNiche: null, brandTone: null, targetAudience: null } },
    },
  });
  return ws.id;
}

/**
 * Resolves the signed-in user's active workspace and role. This is the only
 * way API routes should learn which workspace they're acting on: every query
 * for customer data must be filtered by the returned workspaceId.
 */
export async function getWorkspaceContext(): Promise<WorkspaceContext | null> {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, emailVerified: true },
  });
  if (!user) return null; // account deleted while the JWT was still valid

  let memberships = await prisma.membership.findMany({
    where: { userId },
    include: { workspace: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  });
  if (memberships.length === 0) {
    await ensurePersonalWorkspace(userId, user.name);
    memberships = await prisma.membership.findMany({
      where: { userId },
      include: { workspace: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  let preferred: string | undefined;
  try {
    preferred = (await cookies()).get(WORKSPACE_COOKIE)?.value;
  } catch {
    /* not in a request scope (scripts/tests) */
  }
  const active = memberships.find((m) => m.workspaceId === preferred) || memberships[0];

  return {
    userId,
    email: user.email,
    // Verification can only be required once email can actually be sent;
    // platform admins are trusted.
    emailVerified: !!user.emailVerified || isPlatformAdminEmail(user.email) || !emailConfigured(),
    workspaceId: active.workspaceId,
    workspaceName: active.workspace.name,
    role: (active.role as Role) || 'member',
    isPlatformAdmin: isPlatformAdminEmail(user.email),
  };
}

export interface RequireOptions {
  /** Minimum role in the workspace. */
  role?: Role;
  /** Require a verified email (gates anything that costs money to run). */
  verified?: boolean;
}

export async function requireWorkspace(opts: RequireOptions = {}): Promise<WorkspaceContext> {
  const ctx = await getWorkspaceContext();
  if (!ctx) throw new HttpError(401, 'Sign in to continue.', 'unauthenticated');
  if (opts.role && RANK[ctx.role] < RANK[opts.role]) {
    throw forbidden(opts.role === 'owner' ? 'Only the workspace owner can do that.' : 'Ask a workspace admin to do that.');
  }
  if (opts.verified && !ctx.emailVerified) {
    throw new HttpError(403, 'Verify your email address first — check your inbox for the link, or resend it from Settings.', 'email_unverified');
  }
  return ctx;
}

export async function requirePlatformAdmin(): Promise<WorkspaceContext> {
  const ctx = await requireWorkspace();
  if (!ctx.isPlatformAdmin) throw forbidden('Administrators only.');
  return ctx;
}

/** Loads a project only if it belongs to the workspace; 404 otherwise. */
export async function getOwnedProject(workspaceId: string, projectId: unknown) {
  if (typeof projectId !== 'string' || !projectId) throw new HttpError(400, 'projectId is required.');
  const project = await prisma.project.findFirst({ where: { id: projectId, workspaceId } });
  if (!project) throw new HttpError(404, 'Project not found.');
  return project;
}

/** Loads a clip (with its project) only if it belongs to the workspace. */
export async function getOwnedClip(workspaceId: string, clipId: unknown) {
  if (typeof clipId !== 'string' || !clipId) throw new HttpError(400, 'clipId is required.');
  const clip = await prisma.clip.findFirst({ where: { id: clipId, workspaceId }, include: { project: true } });
  if (!clip) throw new HttpError(404, 'Clip not found.');
  return clip;
}

export async function audit(
  ctx: Pick<WorkspaceContext, 'workspaceId' | 'userId'> | { workspaceId?: string | null; userId?: string | null },
  action: string,
  detail?: Record<string, unknown> | string,
  ip?: string
) {
  try {
    await prisma.auditEvent.create({
      data: {
        workspaceId: ctx.workspaceId ?? null,
        userId: ctx.userId ?? null,
        action,
        detail: typeof detail === 'string' ? detail : detail ? JSON.stringify(detail) : null,
        ip: ip ?? null,
      },
    });
  } catch (err) {
    console.error('[audit] failed to record', action, err);
  }
}
