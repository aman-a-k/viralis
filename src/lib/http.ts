import { NextResponse } from 'next/server';

/** An error whose message is safe and useful to show the customer. */
export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
    this.name = 'HttpError';
  }
}

export const badRequest = (msg: string, code?: string) => new HttpError(400, msg, code);
export const forbidden = (msg = 'You don’t have permission to do that.') => new HttpError(403, msg, 'forbidden');
export const notFound = (msg = 'Not found.') => new HttpError(404, msg, 'not_found');
export const paymentRequired = (msg: string, code = 'limit_reached') => new HttpError(402, msg, code);

/**
 * Turns any thrown value into a JSON error response. HttpErrors keep their
 * status and message; anything else is logged and reported generically (or
 * with `fallback`) so internal details never leak to the browser.
 */
export function errorResponse(err: unknown, fallback = 'Something went wrong. Try again.', tag = 'api') {
  if (err instanceof HttpError) {
    return NextResponse.json({ success: false, error: err.message, code: err.code }, { status: err.status });
  }
  console.error(`[${tag}]`, err);
  // fetch() to an outside service failed before any response (DNS, timeout,
  // connection reset): say so, rather than a vague "something went wrong".
  if (err instanceof TypeError && err.message === 'fetch failed') {
    return NextResponse.json(
      { success: false, error: 'Couldn’t reach an outside service (YouTube/Google) just now. Check the connection and try again in a moment.', code: 'upstream_unreachable' },
      { status: 503 }
    );
  }
  return NextResponse.json({ success: false, error: fallback }, { status: 500 });
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  return (fwd ? fwd.split(',')[0] : req.headers.get('x-real-ip') || 'unknown').trim();
}
