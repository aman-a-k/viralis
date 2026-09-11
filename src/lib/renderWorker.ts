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
