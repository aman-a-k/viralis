import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createHmac } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { getEntitlement } from '@/lib/usage';
import { hasDb, resetDb, makeUser } from './helpers';

const now = Math.floor(Date.now() / 1000);

describe.skipIf(!hasDb)('subscription billing', () => {
  let ws: string;
  let providerState: Record<string, unknown>;

  beforeEach(async () => {
    await resetDb();
    ws = (await makeUser('pay@example.com')).workspaceId;
    process.env.RAZORPAY_KEY_ID = 'rzp_test_x';
    process.env.RAZORPAY_KEY_SECRET = 'key_secret';
    process.env.RAZORPAY_WEBHOOK_SECRET = 'whsec';
    process.env.RAZORPAY_PLAN_CREATOR = 'plan_creator';
    providerState = { id: 'sub_123', plan_id: 'plan_creator', status: 'created', notes: { workspaceId: ws, planId: 'creator' } };
    // Razorpay's API, as seen by the server.
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).endsWith('/subscriptions') && init?.method === 'POST') return Response.json(providerState);
      if (String(url).includes('/subscriptions/sub_123/cancel')) {
        providerState = { ...providerState, status: 'active' };
        return Response.json(providerState);
      }
      if (String(url).includes('/subscriptions/sub_123')) return Response.json(providerState);
      return new Response('{}', { status: 404 });
    }));
  });
  afterEach(() => vi.unstubAllGlobals());

  const webhook = async (eventId: string, signatureSecret = 'whsec') => {
    const { POST } = await import('@/app/api/billing/webhook/route');
    const body = JSON.stringify({ event: 'subscription.activated', payload: { subscription: { entity: { id: 'sub_123' } } } });
    return POST(new Request('http://t/api/billing/webhook', {
      method: 'POST',
      body,
      headers: { 'x-razorpay-event-id': eventId, 'x-razorpay-signature': createHmac('sha256', signatureSecret).update(body).digest('hex') },
    }));
  };

  it('checkout alone grants nothing; a verified webhook activates the plan', async () => {
    const { createCheckout } = await import('@/services/billing');
    await createCheckout(ws, 'creator', 'pay@example.com');
    expect((await getEntitlement(ws)).source).toBe('trial');

    providerState = { ...providerState, status: 'active', current_start: now, current_end: now + 30 * 86400 };
    expect((await webhook('evt_1')).status).toBe(200);
    const e = await getEntitlement(ws);
    expect(e.source).toBe('subscription');
    expect(e.plan.id).toBe('creator');
  });

  it('processes a duplicate delivery only once', async () => {
    const { createCheckout } = await import('@/services/billing');
    await createCheckout(ws, 'creator', null);
    providerState = { ...providerState, status: 'active', current_start: now, current_end: now + 30 * 86400 };
    const first = await (await webhook('evt_dup')).json();
    const second = await (await webhook('evt_dup')).json();
    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(await prisma.billingEvent.count({ where: { eventId: 'evt_dup' } })).toBe(1);
  });

  it('rejects webhooks with a bad signature', async () => {
    expect((await webhook('evt_forged', 'not-the-secret')).status).toBe(400);
    expect(await prisma.billingEvent.count()).toBe(0);
  });

  it('a forged checkout confirmation from the browser is refused', async () => {
    const { createCheckout, confirmCheckout } = await import('@/services/billing');
    await createCheckout(ws, 'creator', null);
    await expect(confirmCheckout(ws, { paymentId: 'pay_1', subscriptionId: 'sub_123', signature: 'forged' })).rejects.toMatchObject({ status: 400 });
    expect((await getEntitlement(ws)).source).toBe('trial');
  });

  it('a correctly signed confirmation still follows the provider’s real state', async () => {
    const { createCheckout, confirmCheckout } = await import('@/services/billing');
    await createCheckout(ws, 'creator', null);
    const signature = createHmac('sha256', 'key_secret').update('pay_1|sub_123').digest('hex');
    providerState = { ...providerState, status: 'authenticated' }; // mandate set up, not yet charged
    await confirmCheckout(ws, { paymentId: 'pay_1', subscriptionId: 'sub_123', signature });
    expect((await getEntitlement(ws)).source).toBe('trial');
  });

  it('cancel keeps access until the period ends', async () => {
    const { createCheckout, cancelSubscription } = await import('@/services/billing');
    await createCheckout(ws, 'creator', null);
    providerState = { ...providerState, status: 'active', current_start: now, current_end: now + 30 * 86400 };
    await webhook('evt_a');
    await cancelSubscription(ws);
    const sub = await prisma.subscription.findUniqueOrThrow({ where: { workspaceId: ws } });
    expect(sub.cancelAtPeriodEnd).toBe(true);
    expect((await getEntitlement(ws)).source).toBe('subscription');
  });
});
