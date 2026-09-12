/**
 * Client for the standalone render worker (see /worker) that actually cuts,
 * reframes, and caption-burns a clip with ffmpeg. Not part of this Next.js
 * deployment — configured via RENDER_WORKER_URL / RENDER_WORKER_SECRET.
 */

export function renderWorkerConfigured(): boolean {
  return Boolean(process.env.RENDER_WORKER_URL && process.env.RENDER_WORKER_SECRET);
}

export interface RenderJob {
  clipId: string;
  youtubeUrl: string;
  startTime: number;
  endTime: number;
  aspectRatio: '9:16' | '1:1' | '16:9';
  captionText: string;
  captionStyle: string;
}

export class RenderWorkerNotConfiguredError extends Error {
  constructor() {
    super(
      'The video-rendering worker isn’t connected yet. See worker/README.md to deploy it (free, ~10 min), then add RENDER_WORKER_URL and RENDER_WORKER_SECRET.'
    );
    this.name = 'RenderWorkerNotConfiguredError';
  }
}

export async function renderClipOnWorker(job: RenderJob): Promise<string> {
  const url = process.env.RENDER_WORKER_URL;
  const secret = process.env.RENDER_WORKER_SECRET;
  if (!url || !secret) throw new RenderWorkerNotConfiguredError();

  const res = await fetch(`${url.replace(/\/$/, '')}/render`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify(job),
    signal: AbortSignal.timeout(55_000),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.error || `Render worker returned HTTP ${res.status}`);
  }
  return data.videoUrl as string;
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

function workerHeaders(secret: string) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` };
}

/**
 * Starts a background transcription job on the worker (it downloads the
 * audio and transcribes it with whisper.cpp — YouTube's caption endpoint now
 * blocks this entirely, even with cookies). Returns the job id immediately;
 * poll with getTranscriptJobStatus. Returns null if the worker isn't
 * configured, so callers can fall back to the direct/synchronous methods.
 */
export async function startTranscriptJob(youtubeUrl: string): Promise<string | null> {
  const url = process.env.RENDER_WORKER_URL;
  const secret = process.env.RENDER_WORKER_SECRET;
  if (!url || !secret) return null;

  const res = await fetch(`${url.replace(/\/$/, '')}/transcript/start`, {
    method: 'POST',
    headers: workerHeaders(secret),
    body: JSON.stringify({ youtubeUrl }),
    signal: AbortSignal.timeout(20_000),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.error || `Render worker returned HTTP ${res.status}`);
  }
  return data.jobId as string;
}

export async function getTranscriptJobStatus(jobId: string): Promise<TranscriptJobStatus> {
  const url = process.env.RENDER_WORKER_URL;
  const secret = process.env.RENDER_WORKER_SECRET;
  if (!url || !secret) throw new RenderWorkerNotConfiguredError();

  const res = await fetch(`${url.replace(/\/$/, '')}/transcript/status/${jobId}`, {
    headers: workerHeaders(secret),
    signal: AbortSignal.timeout(20_000),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.error || `Render worker returned HTTP ${res.status}`);
  }
  return data as TranscriptJobStatus;
}
