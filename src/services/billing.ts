import { createHmac } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { safeEqual } from '../lib/crypto';
import { HttpError, badRequest } from '../lib/http';
import { PLANS, type PlanId, ENTITLED_STATUSES } from '../lib/plans';

/**
 * Subscriptions via Razorpay (INR, UPI/cards/netbanking, recurring mandates).
 *
 * Setup: create one Razorpay plan per paid plan in lib/plans.ts and set
 *   RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET,
 *   RAZORPAY_PLAN_CREATOR (and RAZORPAY_PLAN_GROWTH if that plan is enabled).
 * Webhook URL: <APP_URL>/api/billing/webhook — subscribe to all
 * "subscription.*" events.
 *
 * Access is never granted from the browser's "payment succeeded" callback.
 * Subscription state always comes from Razorpay itself — a signed webhook,
 * or a server-to-server fetch of the subscription.
 */

const API = 'https://api.razorpay.com/v1';

export function billingConfigured(): boolean {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET && process.env.RAZORPAY_WEBHOOK_SECRET);
}

function authHeader() {
  const id = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!id || !secret) throw new HttpError(503, 'Payments aren’t set up yet. Please contact support.', 'billing_unconfigured');
  return `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`;
}

async function razorpay<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: init.method || 'GET',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    body: init.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('[billing] Razorpay error', res.status, data?.error);
    throw new HttpError(502, data?.error?.description || 'The payment provider returned an error. Try again.');
  }
  return data as T;
}

export function razorpayPlanId(plan: PlanId): string | null {
  const env = PLANS[plan].razorpayPlanEnv;
  return env ? process.env[env] || null : null;
}

function planFromRazorpay(planId: string | undefined | null): PlanId | null {
  if (!planId) return null;
  for (const p of Object.values(PLANS)) {
    if (p.razorpayPlanEnv && process.env[p.razorpayPlanEnv] === planId) return p.id;
  }
  return null;
}

interface RazorpaySubscription {
  id: string;
  plan_id: string;
  customer_id?: string | null;
  status: string;
  current_start?: number | null;
  current_end?: number | null;
  ended_at?: number | null;
  short_url?: string;
  notes?: Record<string, string> | [];
}

const fromUnix = (n?: number | null) => (n ? new Date(n * 1000) : null);

/** Starts a subscription and returns what the browser needs to open Razorpay Checkout. */
export async function createCheckout(workspaceId: string, plan: PlanId, email: string | null) {
  const p = PLANS[plan];
  if (!p || plan === 'trial' || !p.available) throw badRequest('That plan isn’t available.');
  const providerPlan = razorpayPlanId(plan);
  if (!providerPlan) throw new HttpError(503, 'This plan isn’t available for purchase yet.', 'billing_unconfigured');

  const existing = await prisma.subscription.findUnique({ where: { workspaceId } });
  if (existing && ENTITLED_STATUSES.has(existing.status) && !existing.cancelAtPeriodEnd) {
    throw badRequest('You already have an active subscription. Manage it from Billing.');
  }
  // Reuse a checkout that was started but not completed.
  if (existing && existing.status === 'created' && existing.planId === plan) {
    return { subscriptionId: existing.providerSubscriptionId, keyId: process.env.RAZORPAY_KEY_ID!, plan: p, email };
  }

  const sub = await razorpay<RazorpaySubscription>('/subscriptions', {
    method: 'POST',
    body: {
      plan_id: providerPlan,
      total_count: 120, // renews monthly for up to 10 years unless canceled
      customer_notify: 1,
      notes: { workspaceId, planId: plan },
    },
  });

  await prisma.subscription.upsert({
    where: { workspaceId },
    update: {
      providerSubscriptionId: sub.id,
      planId: plan,
      status: sub.status,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    },
    create: { workspaceId, providerSubscriptionId: sub.id, planId: plan, status: sub.status },
  });

  return { subscriptionId: sub.id, keyId: process.env.RAZORPAY_KEY_ID!, plan: p, email };
}

/** Pulls the subscription's current state from Razorpay and stores it. */
export async function syncSubscription(providerSubscriptionId: string) {
  const sub = await razorpay<RazorpaySubscription>(`/subscriptions/${encodeURIComponent(providerSubscriptionId)}`);
  const local = await prisma.subscription.findUnique({ where: { providerSubscriptionId: sub.id } });
  const notes = Array.isArray(sub.notes) ? {} : sub.notes || {};
  const workspaceId = local?.workspaceId || notes.workspaceId;
  if (!workspaceId) {
    console.warn('[billing] subscription with no workspace', sub.id);
    return null;
  }
  const plan = planFromRazorpay(sub.plan_id) || (local?.planId as PlanId | undefined) || 'creator';
  const data = {
    providerSubscriptionId: sub.id,
    providerCustomerId: sub.customer_id || null,
    planId: plan,
    status: sub.status,
    currentPeriodStart: fromUnix(sub.current_start),
    currentPeriodEnd: fromUnix(sub.current_end),
    ...(['cancelled', 'completed', 'expired'].includes(sub.status) ? { cancelAtPeriodEnd: false } : {}),
  };

  // A workspace has one subscription row; a newer subscription replaces an
  // ended one, but an old subscription's late webhook never overwrites a newer one.
  const current = await prisma.subscription.findUnique({ where: { workspaceId } });
  if (current && current.providerSubscriptionId !== sub.id) {
    if (ENTITLED_STATUSES.has(current.status) || current.status === 'created') return current;
  }
  return prisma.subscription.upsert({
    where: { workspaceId },
    update: data,
    create: { workspaceId, ...data },
  });
}

/** Verifies Razorpay Checkout's handler signature, then reconciles from the API. */
export async function confirmCheckout(workspaceId: string, input: { paymentId: string; subscriptionId: string; signature: string }) {
  const local = await prisma.subscription.findUnique({ where: { workspaceId } });
  if (!local || local.providerSubscriptionId !== input.subscriptionId) throw badRequest('That payment doesn’t belong to this workspace.');
  const expected = createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
    .update(`${input.paymentId}|${input.subscriptionId}`)
    .digest('hex');
  if (!safeEqual(expected, input.signature || '')) throw badRequest('Payment verification failed.');
  // The signature proves the checkout completed; entitlement still comes
  // from the subscription's real state at Razorpay.
  return syncSubscription(input.subscriptionId);
}

export async function cancelSubscription(workspaceId: string, immediately = false) {
  const local = await prisma.subscription.findUnique({ where: { workspaceId } });
  if (!local || ['cancelled', 'completed', 'expired'].includes(local.status)) throw badRequest('There’s no active subscription to cancel.');
  await razorpay(`/subscriptions/${encodeURIComponent(local.providerSubscriptionId)}/cancel`, {
    method: 'POST',
    body: { cancel_at_cycle_end: immediately || local.status === 'created' ? 0 : 1 },
  });
  await prisma.subscription.update({ where: { workspaceId }, data: { cancelAtPeriodEnd: !immediately } });
  return syncSubscription(local.providerSubscriptionId);
}

export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  return safeEqual(expected, signature);
}

/**
 * Handles a verified webhook exactly once (by Razorpay's event id). The
 * payload only tells us *which* subscription changed; its state is re-read
 * from Razorpay, so out-of-order deliveries can't leave stale state behind.
 */
export async function handleWebhook(eventId: string, rawBody: string) {
  const event = JSON.parse(rawBody);
  try {
    await prisma.billingEvent.create({
      data: { provider: 'razorpay', eventId, type: String(event.event || 'unknown'), payload: rawBody.slice(0, 50_000) },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return { duplicate: true };
    throw err;
  }
  const subId: string | undefined = event?.payload?.subscription?.entity?.id;
  try {
    if (subId) await syncSubscription(subId);
  } catch (err) {
    // Un-record it so Razorpay's retry of this delivery is processed.
    await prisma.billingEvent.delete({ where: { eventId } }).catch(() => {});
    throw err;
  }
  return { duplicate: false };
}

/** Daily reconciliation in case a webhook was missed. */
export async function reconcileSubscriptions() {
  if (!billingConfigured()) return 0;
  const subs = await prisma.subscription.findMany({
    where: { status: { notIn: ['cancelled', 'completed', 'expired'] } },
    select: { providerSubscriptionId: true },
  });
  for (const s of subs) {
    try {
      await syncSubscription(s.providerSubscriptionId);
    } catch (err) {
      console.warn('[billing] reconcile failed', s.providerSubscriptionId, (err as Error).message);
    }
  }
  return subs.length;
}
