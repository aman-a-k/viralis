import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/lib/prisma';
import { hasDb, resetDb, makeUser, makeProjectWithClip, session, json, params } from './helpers';

/**
 * Two customers on the same deployment: everything B tries against A's
 * records must look like it doesn't exist, through the real route handlers.
 */
describe.skipIf(!hasDb)('tenant isolation', () => {
  let a: Awaited<ReturnType<typeof makeUser>>;
  let b: Awaited<ReturnType<typeof makeUser>>;
  let aData: Awaited<ReturnType<typeof makeProjectWithClip>>;
  let bData: Awaited<ReturnType<typeof makeProjectWithClip>>;

  beforeEach(async () => {
    await resetDb();
    a = await makeUser('alice@example.com');
    b = await makeUser('bob@example.com');
    aData = await makeProjectWithClip(a.workspaceId, { clipStatus: 'approved', rendered: true });
    bData = await makeProjectWithClip(b.workspaceId);
    await prisma.approvalQueue.create({
      data: { workspaceId: a.workspaceId, topic: 'A item', script: 's', visualPrompts: '[]', captions: '[]', clipId: aData.clip.id },
    });
    session.userId = b.user.id;
  });

  it('gives every new account its own workspace', () => {
    expect(a.workspaceId).not.toBe(b.workspaceId);
  });

  it('dashboard data only contains the caller’s own records', async () => {
    const { GET } = await import('@/app/api/data/route');
    const res = await (await GET()).json();
    expect(res.success).toBe(true);
    expect(res.data.projects.map((p: { id: string }) => p.id)).toEqual([bData.project.id]);
    expect(res.data.approvalQueue).toHaveLength(0);
    // No storage paths or transcripts leak into the browser payload.
    expect(JSON.stringify(res.data)).not.toContain('ws/');
  });

  it('cannot read another workspace’s project or clip', async () => {
    const project = await import('@/app/api/projects/[projectId]/route');
    expect((await project.GET(new Request('http://t'), params({ projectId: aData.project.id }))).status).toBe(404);
    const clip = await import('@/app/api/clips/[clipId]/route');
    expect((await clip.GET(new Request('http://t'), params({ clipId: aData.clip.id }))).status).toBe(404);
    const captions = await import('@/app/api/clips/[clipId]/captions/route');
    expect((await captions.GET(new Request('http://t/?format=srt'), params({ clipId: aData.clip.id }))).status).toBe(404);
  });

  it('cannot fetch another workspace’s media', async () => {
    const media = await import('@/app/api/media/clip/[clipId]/route');
    expect((await media.GET(new Request('http://t'), params({ clipId: aData.clip.id }))).status).toBe(404);
    const source = await import('@/app/api/media/source/[projectId]/route');
    expect((await source.GET(new Request('http://t'), params({ projectId: aData.project.id }))).status).toBe(404);
  });

  it('cannot edit, delete, export, publish or approve another workspace’s work', async () => {
    const clip = await import('@/app/api/clips/[clipId]/route');
    const patch = await clip.PATCH(
      new Request('http://t', { method: 'PATCH', body: JSON.stringify({ title: 'hijacked', action: 'reject' }) }),
      params({ clipId: aData.clip.id })
    );
    expect(patch.status).toBe(404);

    const project = await import('@/app/api/projects/[projectId]/route');
    expect((await project.DELETE(new Request('http://t', { method: 'DELETE' }), params({ projectId: aData.project.id }))).status).toBe(404);

    const render = await import('@/app/api/repurpose/render/route');
    expect((await render.POST(json({ clipId: aData.clip.id, aspectRatio: '9:16' }))).status).toBe(404);

    const publish = await import('@/app/api/repurpose/publish/route');
    expect((await publish.POST(json({ clipId: aData.clip.id, privacy: 'public' }))).status).toBe(404);

    const item = await prisma.approvalQueue.findFirstOrThrow({ where: { workspaceId: a.workspaceId } });
    const approval = await import('@/app/api/approval/route');
    expect((await approval.POST(json({ id: item.id, action: 'approve' }))).status).toBe(404);

    // A's records are untouched.
    const after = await prisma.clip.findUniqueOrThrow({ where: { id: aData.clip.id } });
    expect(after.title).toBe('First law');
    expect(after.status).toBe('approved');
    expect(await prisma.project.count({ where: { id: aData.project.id } })).toBe(1);
    expect(await prisma.job.count({ where: { workspaceId: a.workspaceId } })).toBe(0);
  });

  it('cannot start an upload from another workspace’s storage area', async () => {
    process.env.RENDER_WORKER_URL = 'http://worker.test';
    process.env.RENDER_WORKER_SECRET = 'w';
    const upload = await import('@/app/api/repurpose/upload/route');
    const res = await upload.POST(json({ blobPath: `ws/${a.workspaceId}/sources/lesson.mp4`, durationSeconds: 60, rightsConfirmed: true }));
    expect(res.status).toBe(400);
    expect(await prisma.project.count({ where: { workspaceId: b.workspaceId } })).toBe(1);
  });

  it('exports only the caller’s own data', async () => {
    const exp = await import('@/app/api/account/export/route');
    const body = await (await exp.GET()).text();
    expect(body).toContain(`Lesson in ${b.workspaceId}`);
    expect(body).not.toContain(a.workspaceId);
  });

  it('rejects signed-out requests', async () => {
    session.userId = null;
    const { GET } = await import('@/app/api/data/route');
    expect((await GET()).status).toBe(401);
  });
});

describe.skipIf(!hasDb)('email verification gate', () => {
  beforeEach(resetDb);

  it('blocks processing for unverified accounts only once email delivery is configured', async () => {
    const u = await makeUser('new@example.com', { verified: false });
    session.userId = u.user.id;
    const { POST } = await import('@/app/api/repurpose/route');
    const body = { transcriptText: 'x '.repeat(200) };

    process.env.RESEND_API_KEY = 're_test';
    process.env.EMAIL_FROM = 'Viralis <a@b.c>';
    const blocked = await POST(json(body));
    expect(blocked.status).toBe(403);
    expect((await blocked.json()).code).toBe('email_unverified');

    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    const allowed = await POST(json(body));
    expect(allowed.status).not.toBe(403);
  });
});
