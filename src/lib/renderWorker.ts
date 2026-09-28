/**
 * Client for the standalone render worker (see /worker) that actually cuts,
 * reframes, and caption-burns a clip with ffmpeg. Not part of this Next.js
 * deployment — configured via RENDER_WORKER_URL / RENDER_WORKER_SECRET.
 */

export function renderWorkerConfigured(): boolean {
  return Boolean(process.env.RENDER_WORKER_URL && process.env.RENDER_WORKER_SECRET);
}

/**
 * Fire-and-forget ping to start waking up the worker if Render's free tier
 * has spun it down (idle >~15min). Callers should invoke this as early as
 * possible — in parallel with other work like a trending-video fetch or LLM
 * call — so the ~30-60s cold-start overlaps with work that's happening
 * anyway, instead of being paid in full right before a real request.
 */
export function warmUpWorker(): void {
  const url = process.env.RENDER_WORKER_URL;
  if (!url) return;
  fetch(`${url.replace(/\/$/, '')}/health`, { signal: AbortSignal.timeout(55_000) }).catch(() => {});
}

/** Where the worker should read the source video from. */
export type MediaSource = { youtubeUrl: string } | { mediaUrl: string };

export type RenderJob = MediaSource & {
  clipId: string;
  startTime: number;
  endTime: number;
  aspectRatio: '9:16' | '1:1' | '16:9';
  captionText: string;
  captionStyle: string;
};

export class RenderWorkerNotConfiguredError extends Error {
  constructor() {
    super(
      'The video-rendering worker isn’t connected yet. See worker/README.md to deploy it (free, ~10 min), then add RENDER_WORKER_URL and RENDER_WORKER_SECRET.'
    );
    this.name = 'RenderWorkerNotConfiguredError';
  }
}

/** The worker restarted and lost the job (jobs live in its memory). */
export class WorkerJobLostError extends Error {
  constructor() {
    super('The worker restarted while this job was running. Try again.');
    this.name = 'WorkerJobLostError';
  }
}

function workerConfig() {
  const url = process.env.RENDER_WORKER_URL;
  const secret = process.env.RENDER_WORKER_SECRET;
  if (!url || !secret) throw new RenderWorkerNotConfiguredError();
  return { base: url.replace(/\/$/, ''), secret };
}

async function workerRequest<T>(path: string, init: { method?: string; body?: unknown; timeoutMs: number }): Promise<T> {
  const { base, secret } = workerConfig();
  const res = await fetch(`${base}${path}`, {
    method: init.method || 'GET',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(init.timeoutMs),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 404 && path.includes('/status/')) throw new WorkerJobLostError();
  if (!res.ok || !data.success) {
    throw new Error(data.error || `Render worker returned HTTP ${res.status}`);
  }
  return data as T;
}

// Render's free tier spins down after ~15 minutes idle and can take 30-60s
// to wake, so starting a job needs real headroom, not a quick fail.
const START_TIMEOUT_MS = 55_000;

/** Starts a background render; poll with getRenderJobStatus. */
export async function startRenderJob(job: RenderJob): Promise<string> {
  const data = await workerRequest<{ jobId: string }>('/render/start', {
    method: 'POST',
    body: job,
    timeoutMs: START_TIMEOUT_MS,
  });
  return data.jobId;
}

export type RenderJobStatus =
  | { status: 'processing' }
  | { status: 'done'; videoUrl: string }
  | { status: 'error'; error: string };

export async function getRenderJobStatus(jobId: string): Promise<RenderJobStatus> {
  return workerRequest<RenderJobStatus>(`/render/status/${encodeURIComponent(jobId)}`, { timeoutMs: 20_000 });
}

export interface WorkerTranscriptSegment {
  text: string;
  start: number;
  end: number;
}

export type TranscriptJobStatus =
  | { status: 'processing' }
  | { status: 'done'; transcript: WorkerTranscriptSegment[] }
  | { status: 'error'; error: string };

/**
 * Starts a background transcription job on the worker (audio from YouTube or
 * from an uploaded file, transcribed with whisper.cpp). Returns the job id
 * immediately; poll with getTranscriptJobStatus. Returns null if the worker
 * isn't configured, so callers can fall back to the direct methods.
 */
export async function startTranscriptJob(source: MediaSource): Promise<string | null> {
  if (!renderWorkerConfigured()) return null;
  const data = await workerRequest<{ jobId: string }>('/transcript/start', {
    method: 'POST',
    body: source,
    timeoutMs: START_TIMEOUT_MS,
  });
  return data.jobId;
}

export async function getTranscriptJobStatus(jobId: string): Promise<TranscriptJobStatus> {
  return workerRequest<TranscriptJobStatus>(`/transcript/status/${encodeURIComponent(jobId)}`, { timeoutMs: 20_000 });
}
