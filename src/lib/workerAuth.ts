import { safeEqual } from './crypto';

/** True when the request carries the shared worker secret. */
export function isWorkerRequest(req: Request): boolean {
  const secret = process.env.RENDER_WORKER_SECRET;
  if (!secret) return false;
  return safeEqual(req.headers.get('authorization') || '', `Bearer ${secret}`);
}
