import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireWorkspace, audit } from '@/lib/workspace';
import { errorResponse, badRequest } from '@/lib/http';
import { normalizeLanguage } from '@/services/pipeline';

const PLATFORMS = ['instagram', 'youtube', 'linkedin', 'twitter', 'tiktok'];
const ORIENTATIONS = ['9:16', '1:1', '16:9'];

const text = (v: unknown, max: number) => (v === undefined ? undefined : typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

/** Workspace brand + default output preferences (admins), and workspace name/retention. */
export async function POST(req: Request) {
  try {
    const ctx = await requireWorkspace({ role: 'admin' });
    const body = await req.json().catch(() => ({}));

    const pick = (v: unknown, allowed: string[]) =>
      Array.isArray(v) ? JSON.stringify(v.filter((x) => allowed.includes(x))) : undefined;

    const data = {
      brandName: text(body.brandName, 80),
      brandNiche: text(body.brandNiche, 120),
      brandTone: text(body.brandTone, 120),
      targetAudience: text(body.targetAudience, 160),
      captionStyle: body.captionStyle === undefined ? undefined : body.captionStyle === 'Minimalist' ? 'Minimalist' : 'Dynamic Pop',
      defaultLanguage: body.defaultLanguage === undefined ? undefined : normalizeLanguage(body.defaultLanguage),
      defaultPlatforms: pick(body.defaultPlatforms, PLATFORMS),
      defaultOrientations: pick(body.defaultOrientations, ORIENTATIONS),
    };
    await prisma.settings.upsert({
      where: { workspaceId: ctx.workspaceId },
      update: data,
      create: { workspaceId: ctx.workspaceId, ...Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)) },
    });

    const ws: { name?: string; retentionDays?: number } = {};
    if (typeof body.workspaceName === 'string') {
      if (!body.workspaceName.trim()) throw badRequest('Workspace name can’t be empty.');
      ws.name = body.workspaceName.trim().slice(0, 80);
    }
    if (body.retentionDays !== undefined) {
      const days = Number(body.retentionDays);
      if (![7, 14, 30, 60, 90].includes(days)) throw badRequest('Choose a supported retention period.');
      ws.retentionDays = days;
    }
    if (Object.keys(ws).length) await prisma.workspace.update({ where: { id: ctx.workspaceId }, data: ws });
    const changed = [...Object.entries(data).filter(([, v]) => v !== undefined).map(([k]) => k), ...Object.keys(ws)];
    await audit(ctx, 'settings.update', { fields: changed });
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, 'Could not save settings.', 'api/settings');
  }
}
