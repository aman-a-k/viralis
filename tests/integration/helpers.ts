import { prisma } from '@/lib/prisma';

export const hasDb = Boolean(process.env.TEST_DATABASE_URL);

/** Empties every application table between tests. */
export async function resetDb() {
  const rows = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (rows.length) {
    await prisma.$executeRawUnsafe(`TRUNCATE ${rows.map((r) => `"${r.tablename}"`).join(', ')} CASCADE`);
  }
}

export async function makeUser(email: string, opts: { verified?: boolean } = {}) {
  const { ensurePersonalWorkspace } = await import('@/lib/workspace');
  const user = await prisma.user.create({ data: { email, name: email.split('@')[0], emailVerified: opts.verified === false ? null : new Date() } });
  const workspaceId = await ensurePersonalWorkspace(user.id, user.name);
  return { user, workspaceId };
}

export async function makeProjectWithClip(workspaceId: string, opts: { status?: string; clipStatus?: string; rendered?: boolean } = {}) {
  const segments = [
    { text: 'नमस्ते, today we learn thermodynamics.', start: 0, end: 6 },
    { text: 'Energy is never created or destroyed.', start: 6, end: 12 },
    { text: 'It only changes form, and that is the first law.', start: 12, end: 20 },
  ];
  const project = await prisma.project.create({
    data: {
      workspaceId,
      title: `Lesson in ${workspaceId}`,
      sourceType: 'upload',
      sourceBlobPath: `ws/${workspaceId}/sources/lesson.mp4`,
      transcriptJson: JSON.stringify(segments),
      transcript: segments.map((s) => s.text).join(' '),
      duration: 20,
      status: opts.status || 'ready',
    },
  });
  const clip = await prisma.clip.create({
    data: {
      workspaceId,
      projectId: project.id,
      title: 'First law',
      startTime: 0,
      endTime: 20,
      duration: 20,
      reasoning: 'clear explanation',
      transcriptSegment: segments.map((s) => s.text).join(' '),
      captionVersions: JSON.stringify({ youtube: 'The first law #physics' }),
      status: opts.clipStatus || 'candidate',
      renderBlobPath: opts.rendered ? `ws/${workspaceId}/renders/clip.mp4` : null,
      renderStatus: opts.rendered ? 'rendered' : null,
    },
  });
  return { project, clip };
}

export { testSession as session } from '../setup';

export const json = (body: unknown) =>
  new Request('http://test.local/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

export const params = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) });
