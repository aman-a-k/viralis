// Browser-side helpers shared by the dashboard views.

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
  }
}

/** JSON request to our own API. Throws ApiError with the server's message on failure. */
export async function api<T = Record<string, unknown>>(
  url: string,
  init: { method?: string; body?: unknown; signal?: AbortSignal } = {}
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: init.method || (init.body !== undefined ? 'POST' : 'GET'),
      headers: init.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: 'no-store',
      signal: init.signal,
    });
  } catch {
    throw new ApiError('Network error — check your connection and try again.', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    throw new ApiError(data.error || `Request failed (HTTP ${res.status}).`, res.status, data.code);
  }
  return data as T;
}

export const errorMessage = (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong.');

export function fmtTime(s: number | null | undefined): string {
  const t = Math.max(0, Math.floor(Number(s) || 0));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = t % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

/** "1:23.4" — editor precision. */
export function fmtPrecise(s: number): string {
  const t = Math.max(0, s);
  const m = Math.floor(t / 60);
  const sec = (t % 60).toFixed(1).padStart(4, '0');
  return `${m}:${sec}`;
}

/** Parses "1:23.4", "83.4" or "1:02:03" into seconds; NaN if invalid. */
export function parseTime(v: string): number {
  const parts = v.trim().split(':').map(Number);
  if (!parts.length || parts.some((p) => !Number.isFinite(p) || p < 0)) return NaN;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

export function fmtViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Reads a media file's duration in the browser (seconds), or 0 if it can't. */
export function readMediaDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const el = document.createElement(file.type.startsWith('audio/') ? 'audio' : 'video');
    const done = (v: number) => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(v) ? v : 0);
    };
    el.preload = 'metadata';
    el.onloadedmetadata = () => done(el.duration);
    el.onerror = () => done(0);
    setTimeout(() => done(0), 15_000);
    el.src = url;
  });
}

export const LANGUAGES: [string, string][] = [
  ['auto', 'Detect automatically'],
  ['en', 'English'],
  ['hi', 'Hindi'],
  ['kn', 'Kannada'],
  ['ta', 'Tamil'],
  ['te', 'Telugu'],
  ['ml', 'Malayalam'],
  ['mr', 'Marathi'],
  ['bn', 'Bengali'],
  ['gu', 'Gujarati'],
  ['pa', 'Punjabi'],
  ['ur', 'Urdu'],
  ['es', 'Spanish'],
  ['fr', 'French'],
  ['de', 'German'],
  ['pt', 'Portuguese'],
  ['ar', 'Arabic'],
  ['id', 'Indonesian'],
];

/** "1 clip" / "4 clips", not counting dismissed ones. */
export function clipCountLabel(clips: { status: string }[]): string {
  const n = clips.filter((c) => c.status !== 'rejected').length;
  return `${n} clip${n === 1 ? '' : 's'}`;
}
