/**
 * The plans customers can be on. Limits here are enforced server-side by
 * lib/usage.ts — the pricing page reads the same table, so what's advertised
 * is what's enforced.
 *
 * Prices are in paise (₹1 = 100 paise), exclusive of GST. Each paid plan
 * maps to a Razorpay plan id supplied via env (create the plans in the
 * Razorpay dashboard, then set RAZORPAY_PLAN_<ID>).
 */
export type PlanId = 'trial' | 'creator' | 'growth';

export interface Plan {
  id: PlanId;
  name: string;
  pricePaise: number;
  interval: 'once' | 'month';
  sourceMinutes: number;
  exports: number;
  /** Longest single recording accepted, in minutes. */
  maxSourceMinutes: number;
  /** Largest upload accepted, in MB. */
  maxUploadMb: number;
  retentionDays: number;
  channels: number;
  /** Sold to new customers (shown on pricing, available at checkout). */
  available: boolean;
  razorpayPlanEnv?: string;
  blurb: string;
}

export const PLANS: Record<PlanId, Plan> = {
  trial: {
    id: 'trial',
    name: 'Free trial',
    pricePaise: 0,
    interval: 'once',
    sourceMinutes: 15,
    exports: 3,
    maxSourceMinutes: 15,
    maxUploadMb: 300,
    retentionDays: 7,
    channels: 1,
    available: true,
    blurb: 'One-time allowance to try it on your own recording. No card needed.',
  },
  creator: {
    id: 'creator',
    name: 'Creator',
    pricePaise: 99_900,
    interval: 'month',
    sourceMinutes: 120,
    exports: 20,
    maxSourceMinutes: 90,
    maxUploadMb: 2000,
    retentionDays: 30,
    channels: 1,
    available: true,
    razorpayPlanEnv: 'RAZORPAY_PLAN_CREATOR',
    blurb: 'For a weekly lesson, webinar or podcast episode.',
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    pricePaise: 199_900,
    interval: 'month',
    sourceMinutes: 300,
    exports: 60,
    maxSourceMinutes: 120,
    maxUploadMb: 4000,
    retentionDays: 60,
    channels: 1,
    // Off until real usage data supports the price (set PLAN_GROWTH_ENABLED=true).
    available: process.env.PLAN_GROWTH_ENABLED === 'true',
    razorpayPlanEnv: 'RAZORPAY_PLAN_GROWTH',
    blurb: 'For several recordings a week.',
  },
};

export const PAID_PLANS = (Object.values(PLANS) as Plan[]).filter((p) => p.id !== 'trial');

export function isPlanId(v: unknown): v is PlanId {
  return typeof v === 'string' && v in PLANS;
}

export function formatInr(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

/**
 * Subscription statuses that grant the paid plan's allowance: "active", and
 * "pending" (a renewal charge failed and Razorpay is retrying — the customer
 * keeps access during the retry window). "authenticated" alone is a mandate
 * with no successful charge yet, so it does not.
 */
export const ENTITLED_STATUSES = new Set(['active', 'pending']);
