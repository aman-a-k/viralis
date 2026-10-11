import { NextResponse } from 'next/server';
import { handleWebhook, verifyWebhookSignature } from '@/services/billing';

/** Razorpay webhooks. Signature-verified and processed once per event id. */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyWebhookSignature(raw, req.headers.get('x-razorpay-signature'))) {
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
  }
  const eventId = req.headers.get('x-razorpay-event-id');
  if (!eventId) return NextResponse.json({ error: 'Missing event id.' }, { status: 400 });
  try {
    const result = await handleWebhook(eventId, raw);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    // A 5xx makes Razorpay retry the delivery later.
    console.error('[billing webhook]', error);
    return NextResponse.json({ error: 'Processing failed.' }, { status: 500 });
  }
}
