// Browser-side helpers for the async render flow: start a render job, then
// poll it until the worker finishes. Rendering a clip takes minutes on the
// free-tier worker, so this can't be one request.

const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 25 * 60 * 1000;

export type RenderOutcome = { ok: true; videoUrl: string } | { ok: false; error: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Polls /api/repurpose/render/status until the job is done, fails, or we give up. */
export async function waitForRender(clipId: string, jobId: string): Promise<RenderOutcome> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let networkErrors = 0;
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    try {
      const res = await fetch('/api/repurpose/render/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clipId, jobId }),
      });
      const data = await res.json();
      if (!data.success) return { ok: false, error: data.error || 'Could not check the render.' };
      if (data.status === 'done') return { ok: true, videoUrl: data.videoUrl };
      if (data.status === 'error') return { ok: false, error: data.error || 'Rendering failed.' };
      networkErrors = 0;
    } catch {
      // Transient network blip — keep trying, but not forever.
      if (++networkErrors >= 5) return { ok: false, error: 'Lost connection while rendering. Try again.' };
    }
  }
  return { ok: false, error: 'Rendering is taking longer than expected. Check back later — it may still finish.' };
}

/** Starts a render and waits for it. */
export async function renderClip(
  clipId: string,
  opts: { aspectRatio?: string; captionStyle?: string } = {}
): Promise<RenderOutcome> {
  try {
    const res = await fetch('/api/repurpose/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clipId, ...opts }),
    });
    const data = await res.json();
    if (!data.success) return { ok: false, error: data.error || 'Could not start rendering.' };
    if (data.status === 'done') return { ok: true, videoUrl: data.videoUrl };
    return waitForRender(clipId, data.jobId);
  } catch {
    return { ok: false, error: 'Network error starting the render.' };
  }
}
