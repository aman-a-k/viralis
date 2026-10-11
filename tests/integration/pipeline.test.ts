import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { getUsage } from '@/lib/usage';
import { hasDb, resetDb, makeUser, session, json, params } from './helpers';

// The AI model: returns clips anchored inside whatever transcript window it's shown.
const llmCalls: string[] = [];
vi.mock('@/lib/llm', async (orig) => {
  const actual = await orig<typeof import('@/lib/llm')>();
  return {
    ...actual,
    getLlmClient: vi.fn(async () => ({
      model: 'test',
      provider: 'gemini',
      client: {
        chat: {
          completions: {
            create: vi.fn(async ({ messages }: { messages: { content: string }[] }) => {
              const prompt = messages[messages.length - 1].content;
              llmCalls.push(prompt);
              const range = prompt.match(/EXCERPT \((\d+):(\d+)–/);
              const start = range ? Number(range[1]) * 60 + Number(range[2]) : 0;
              const clips = [
                { title: `Moment at ${start}`, startTime: start + 1, endTime: start + 21, viralityScore: 70 + (start % 13), hookType: 'insight', reasoning: 'clear', captions: { youtube: 'yt copy #learn', instagram: 'ig copy' } },
              ];
              return { choices: [{ message: { content: JSON.stringify({ clips }) } }] };
            }),
          },
        },
      },
    })),
  };
});
vi.mock('@/lib/storage', async (orig) => ({
  ...(await orig<typeof import('@/lib/storage')>()),
  signedReadUrl: vi.fn(async (p: string) => `https://signed.test/${p}?sig=1`),
  deleteMedia: vi.fn(async () => {}),
}));

const WORKER = { Authorization: 'Bearer worker-secret', 'Content-Type': 'application/json' };
const workerCall = async (path: string, body: unknown) => {
  if (path === '/api/worker/claim') {
    const { POST } = await import('@/app/api/worker/claim/route');
    return (await POST(new Request(`http://t${path}`, { method: 'POST', headers: WORKER, body: JSON.stringify(body) }))).json();
  }
  const jobId = path.split('/').pop()!;
  const { POST } = await import('@/app/api/worker/jobs/[jobId]/route');
  const res = await POST(new Request(`http://t${path}`, { method: 'POST', headers: WORKER, body: JSON.stringify(body) }), params({ jobId }));
  return { status: res.status, ...(await res.json()) };
};

const hindiEnglishSegments = Array.from({ length: 30 }, (_, i) => {
  const words = (i % 2 ? `यह वाक्य नंबर ${i} है।` : `Sentence ${i} explains the idea.`).split(' ');
  const start = i * 4;
  return { text: words.join(' '), start, end: start + 4, words: words.map((w, k) => ({ w, s: start + k * 0.8, e: start + k * 0.8 + 0.7 })) };
});

describe.skipIf(!hasDb)('customer journey: upload → clips → review → export', () => {
  let ws: string;
  beforeEach(async () => {
    await resetDb();
    llmCalls.length = 0;
    process.env.RENDER_WORKER_URL = 'http://worker.test';
    process.env.RENDER_WORKER_SECRET = 'worker-secret';
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ ok: true }))); // worker wake pings
    const u = await makeUser('teacher@example.com');
    ws = u.workspaceId;
    session.userId = u.user.id;
  });

  it('runs the whole flow and charges exactly what was used', async () => {
    // 1. The browser finished uploading; start processing.
    const upload = await import('@/app/api/repurpose/upload/route');
    const started = await (await upload.POST(json({
      blobPath: `ws/${ws}/sources/lesson-abc.mp4`, title: 'Week 3', durationSeconds: 125, rightsConfirmed: true, language: 'hi', clipCount: 3,
    }))).json();
    expect(started.success).toBe(true);
    expect(started.project.status).toBe('transcribing');
    const projectId = started.project.id;

    // 2. The worker claims the transcription with a signed, short-lived URL.
    const claim = await workerCall('/api/worker/claim', { workerId: 'w1' });
    expect(claim.job.type).toBe('transcribe');
    expect(claim.job.source.mediaUrl).toMatch(/^https:\/\/signed\.test\/ws\//);
    expect(claim.job.language).toBe('hi');

    // 3. It reports progress, then the transcript (word-level, mixed scripts).
    expect((await workerCall(`/api/worker/jobs/${claim.job.jobId}`, { workerId: 'w1', action: 'heartbeat', progress: 'Transcribing' })).ok).toBe(true);
    await workerCall(`/api/worker/jobs/${claim.job.jobId}`, { workerId: 'w1', action: 'complete', result: { segments: hindiEnglishSegments, durationSeconds: 120, language: 'hi' } });
    let project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
    expect(project.status).toBe('analyzing');
    expect(project.transcript).toContain('वाक्य');

    // 4. Analysis runs in the app.
    const { runAnalysisSlice } = await import('@/services/pipeline');
    await runAnalysisSlice({ projectId });
    project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
    expect(project.status).toBe('ready');
    const clips = await prisma.clip.findMany({ where: { projectId } });
    expect(clips.length).toBeGreaterThan(0);
    expect(llmCalls[0]).toContain('hi'); // asked to write in the recording's language

    // Processing minutes settled on the real length (120s), not the estimate.
    expect((await getUsage(ws)).source_seconds).toBe(120);

    // 5. Review: send to the queue and approve -> export starts.
    const clipRoute = await import('@/app/api/clips/[clipId]/route');
    await clipRoute.PATCH(new Request('http://t', { method: 'PATCH', body: JSON.stringify({ action: 'send_to_review' }) }), params({ clipId: clips[0].id }));
    const item = await prisma.approvalQueue.findFirstOrThrow({ where: { clipId: clips[0].id } });
    const approval = await import('@/app/api/approval/route');
    const decided = await (await approval.POST(json({ id: item.id, action: 'approve' }))).json();
    expect(decided.message).toMatch(/exporting/i);

    // 6. The worker renders with cues that cover every spoken word.
    const render = await workerCall('/api/worker/claim', { workerId: 'w1' });
    expect(render.job.type).toBe('render');
    expect(render.job.outputPrefix).toBe(`ws/${ws}/renders/`);
    const spoken = await import('@/services/pipeline').then(async (m) => {
      const c = await prisma.clip.findUniqueOrThrow({ where: { id: clips[0].id }, include: { project: true } });
      return m.clipWords(c, c.project).map((w) => w.w);
    });
    const shown = render.job.cues.flatMap((c: { text: string }) => c.text.split(' '));
    expect(shown).toEqual(spoken);
    expect(shown.join(' ')).toMatch(/[ऀ-ॿ]|Sentence/);

    // A result written outside the workspace's area is refused.
    await workerCall(`/api/worker/jobs/${render.job.jobId}`, { workerId: 'w1', action: 'complete', result: { pathname: `ws/someone-else/renders/x.mp4` } });
    expect((await prisma.clip.findUniqueOrThrow({ where: { id: clips[0].id } })).renderStatus).not.toBe('rendered');

    // ...and goes back to the queue for another attempt.
    await prisma.job.update({ where: { id: render.job.jobId }, data: { runAfter: new Date() } });
    const retry = await workerCall('/api/worker/claim', { workerId: 'w1' });
    expect(retry.job.jobId).toBe(render.job.jobId);
    await workerCall(`/api/worker/jobs/${retry.job.jobId}`, { workerId: 'w1', action: 'complete', result: { pathname: `ws/${ws}/renders/${clips[0].id}_9x16-xyz.mp4` } });
    const rendered = await prisma.clip.findUniqueOrThrow({ where: { id: clips[0].id } });
    expect(rendered.renderStatus).toBe('rendered');
    expect(rendered.status).toBe('approved');
    expect((await getUsage(ws)).exports).toBe(1);

    // 7. Download goes through a signed redirect for members only.
    const media = await import('@/app/api/media/clip/[clipId]/route');
    const dl = await media.GET(new Request('http://t'), params({ clipId: clips[0].id }));
    expect(dl.status).toBe(302);
    expect(dl.headers.get('location')).toContain('signed.test');
  });

  it('a worker crash mid-transcription is retried and not double-charged', async () => {
    const upload = await import('@/app/api/repurpose/upload/route');
    const { project } = await (await upload.POST(json({ blobPath: `ws/${ws}/sources/a.mp4`, durationSeconds: 90, rightsConfirmed: true }))).json();

    const first = await workerCall('/api/worker/claim', { workerId: 'crashy' });
    // The worker dies; its lease lapses.
    await prisma.job.update({ where: { id: first.job.jobId }, data: { leaseUntil: new Date(Date.now() - 1000) } });
    const second = await workerCall('/api/worker/claim', { workerId: 'healthy' });
    expect(second.job.jobId).toBe(first.job.jobId);

    // The dead worker's late report is ignored.
    expect((await workerCall(`/api/worker/jobs/${first.job.jobId}`, { workerId: 'crashy', action: 'complete', result: { segments: [], durationSeconds: 1 } })).status).toBe(409);
    await workerCall(`/api/worker/jobs/${second.job.jobId}`, { workerId: 'healthy', action: 'complete', result: { segments: hindiEnglishSegments.slice(0, 20), durationSeconds: 80 } });
    expect((await prisma.project.findUniqueOrThrow({ where: { id: project.id } })).status).toBe('analyzing');
    expect((await getUsage(ws)).source_seconds).toBe(80);
  });

  it('a permanent failure tells the customer why and returns their minutes', async () => {
    const upload = await import('@/app/api/repurpose/upload/route');
    const { project } = await (await upload.POST(json({ blobPath: `ws/${ws}/sources/bad.mov`, durationSeconds: 300, rightsConfirmed: true }))).json();
    expect((await getUsage(ws)).source_seconds).toBe(300);
    const c = await workerCall('/api/worker/claim', { workerId: 'w' });
    await workerCall(`/api/worker/jobs/${c.job.jobId}`, { workerId: 'w', action: 'fail', error: 'We couldn’t read that file.', retryable: false });
    const p = await prisma.project.findUniqueOrThrow({ where: { id: project.id } });
    expect(p.status).toBe('failed');
    expect(p.errorMessage).toContain('couldn’t read');
    expect((await getUsage(ws)).source_seconds).toBe(0);
  });

  it('rejects uploads without a rights confirmation, or longer than the plan allows', async () => {
    const upload = await import('@/app/api/repurpose/upload/route');
    expect((await upload.POST(json({ blobPath: `ws/${ws}/sources/a.mp4`, durationSeconds: 60 }))).status).toBe(400);
    expect((await upload.POST(json({ blobPath: `ws/${ws}/sources/a.mp4`, durationSeconds: 3 * 3600, rightsConfirmed: true }))).status).toBe(402);
  });

  it('analyzes a long recording across several slices without losing progress', async () => {
    const { ingestTranscript, runAnalysisSlice } = await import('@/services/pipeline');
    await prisma.workspace.update({ where: { id: ws }, data: { trialGranted: false } });
    const text = Array.from({ length: 1200 }, (_, i) => `This is sentence ${i} of a long lecture about physics and energy.`).join(' ');
    const project = await ingestTranscript({ workspaceId: ws, userId: session.userId!, unlimited: true }, { title: 'Long', text, clipCount: 5, config: {} });
    let rounds = 0;
    // A tiny time budget forces one window per slice.
    while ((await prisma.project.findUniqueOrThrow({ where: { id: project.id } })).status === 'analyzing' && rounds < 50) {
      await runAnalysisSlice({ projectId: project.id, budgetMs: 1 });
      rounds++;
    }
    const done = await prisma.project.findUniqueOrThrow({ where: { id: project.id }, include: { clips: true } });
    expect(done.status).toBe('ready');
    expect(rounds).toBeGreaterThan(2);
    // Clips come from across the recording, not only its beginning.
    const starts = done.clips.map((c) => c.startTime).sort((a, b) => a - b);
    expect(starts[starts.length - 1]).toBeGreaterThan(done.duration! / 2);
  });
});
