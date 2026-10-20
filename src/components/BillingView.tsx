"use client";

import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Check, CreditCard, RefreshCw, ShieldCheck, Receipt } from 'lucide-react';
import { CountUp, Reveal } from './motion';
import { api, errorMessage, fmtDate } from '@/lib/client';

interface Plan {
  id: string;
  name: string;
  pricePaise: number;
  interval: 'once' | 'month';
  sourceMinutes: number;
  exports: number;
  maxSourceMinutes: number;
  maxUploadMb: number;
  retentionDays: number;
  blurb: string;
}

interface BillingData {
  billingAvailable: boolean;
  canManage: boolean;
  entitlement: {
    planId: string;
    planName: string;
    source: 'subscription' | 'trial' | 'none' | 'unlimited';
    periodEnd: string | null;
    limits: { sourceMinutes: number; exports: number };
    used: { sourceMinutes: number; exports: number };
  };
  subscription: { planId: string; status: string; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean } | null;
  plans: Plan[];
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void; on: (event: string, cb: (r: unknown) => void) => void };
  }
}

function loadCheckoutScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load the payment window. Check your connection or disable blockers for this site.'));
    document.body.appendChild(s);
  });
}

const inr = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`;

function UsageRing({ label, used, limit, unit }: { label: string; used: number; limit: number; unit: string }) {
  const r = 46;
  const c = 2 * Math.PI * r;
  const pct = limit > 0 ? Math.min(1, used / limit) : 1;
  const left = Math.max(0, limit - used);
  const color = pct >= 0.9 ? 'var(--amber)' : 'var(--accent)';
  return (
    <div className="usage-big" role="meter" aria-label={label} aria-valuenow={used} aria-valuemin={0} aria-valuemax={limit}>
      <div className="ring">
        <svg width="108" height="108" viewBox="0 0 108 108" aria-hidden="true">
          <circle cx="54" cy="54" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="8" />
          <circle className="arc" cx="54" cy="54" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} />
        </svg>
        <div className="val"><b className="tnum"><CountUp value={left} /></b><span>{unit} left</span></div>
      </div>
      <span>{label}</span>
      <span className="text-subtle tnum" style={{ fontSize: '0.7rem', fontWeight: 500 }}>{used} of {limit} used</span>
    </div>
  );
}

export function BillingView({ onChanged }: { onChanged: () => void }) {
  const [data, setData] = useState<BillingData | null>(null);
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    try {
      setData(await api<BillingData>('/api/billing'));
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    api<BillingData>('/api/billing').then(setData).catch((err) => toast.error(errorMessage(err)));
  }, []);

  // After checkout the plan activates when Razorpay confirms; check a few times.
  const waitForActivation = async () => {
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const d = await api<BillingData>('/api/billing').catch(() => null);
      if (d) setData(d);
      if (d?.entitlement.source === 'subscription') {
        toast.success('Your plan is active.');
        onChanged();
        return;
      }
    }
    toast('Payment received. Your plan will activate as soon as the bank confirms — usually within a few minutes.', { duration: 9000 });
  };

  const subscribe = async (planId: string) => {
    setBusy(planId);
    try {
      const checkout = await api<{ keyId: string; subscriptionId: string; planName: string; email: string | null }>('/api/billing/checkout', { body: { plan: planId } });
      await loadCheckoutScript();
      const rzp = new window.Razorpay!({
        key: checkout.keyId,
        subscription_id: checkout.subscriptionId,
        name: 'Viralis',
        description: `${checkout.planName} plan — monthly`,
        prefill: checkout.email ? { email: checkout.email } : undefined,
        theme: { color: '#ff5a1f' },
        handler: async (response: Record<string, string>) => {
          try {
            const res = await api<{ active: boolean; message: string }>('/api/billing/confirm', { body: response });
            if (res.active) {
              toast.success(res.message);
              onChanged();
              load();
            } else {
              toast(res.message, { duration: 8000 });
              await waitForActivation();
            }
          } catch (err) {
            toast.error(errorMessage(err));
          }
        },
        modal: { ondismiss: () => setBusy('') },
      });
      rzp.on('payment.failed', () => toast.error('The payment didn’t go through. You haven’t been charged — try again or use another method.'));
      rzp.open();
    } catch (err) {
      toast.error(errorMessage(err), { duration: 8000 });
    } finally {
      setBusy('');
    }
  };

  const cancel = async () => {
    if (!window.confirm('Cancel your subscription? You keep your plan until the end of the period you’ve paid for, and won’t be charged again.')) return;
    setBusy('cancel');
    try {
      const res = await api<{ message: string }>('/api/billing/cancel', { method: 'POST', body: {} });
      toast.success(res.message, { duration: 9000 });
      load();
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy('');
    }
  };

  if (!data) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }} role="status" aria-label="Loading billing">
        <div className="skeleton" style={{ height: 190, borderRadius: 18 }} />
        <div className="grid-cols-2">{[0, 1].map((i) => <div key={i} className="skeleton" style={{ height: 320, borderRadius: 18 }} />)}</div>
      </div>
    );
  }
  const { entitlement: e, subscription: sub } = data;
  const activeSub = sub && ['active', 'pending'].includes(sub.status);
  const heading = e.source === 'unlimited' ? 'Internal account' : e.source === 'subscription' ? `${e.planName} plan` : e.source === 'trial' ? 'Free trial' : 'No active plan';
  const status = e.source === 'subscription' && e.periodEnd
    ? sub?.cancelAtPeriodEnd ? `Ends ${fmtDate(e.periodEnd)} — won’t renew` : `Renews ${fmtDate(e.periodEnd)}`
    : e.source === 'trial' ? 'One-time allowance' : e.source === 'unlimited' ? 'Unmetered' : 'Choose a plan below to keep processing';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <section className="plan-hero" aria-labelledby="usage-h">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', minWidth: 0 }}>
          <span className="eyebrow">Current plan</span>
          <h2 id="usage-h">{heading}</h2>
          <span className={`badge badge-dot ${e.source === 'none' ? 'badge-warning' : sub?.cancelAtPeriodEnd ? 'badge-neutral' : 'badge-success'}`} style={{ alignSelf: 'flex-start' }}>{status}</span>
          <p className="text-subtle" style={{ fontSize: '0.75rem', maxWidth: 440 }}>
            Processing time counts the length of each recording you add. Each video export (including re-exports after edits) counts once. Anything that fails on our side is returned automatically.
          </p>
          {activeSub && !sub!.cancelAtPeriodEnd && data.canManage && (
            <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start', marginLeft: '-0.6rem' }} disabled={busy === 'cancel'} onClick={cancel}>Cancel subscription</button>
          )}
        </div>
        {e.source !== 'unlimited' && (
          <div className="usage-rings">
            <UsageRing label="Processing time" used={e.used.sourceMinutes} limit={e.limits.sourceMinutes} unit="min" />
            <UsageRing label="Video exports" used={e.used.exports} limit={e.limits.exports} unit="exports" />
          </div>
        )}
      </section>

      {sub?.status === 'pending' && (
        <p className="notice notice-warning">Your last renewal payment failed and is being retried. Update your payment method from the link in Razorpay’s email to avoid losing access.</p>
      )}
      {sub?.status === 'halted' && (
        <p className="notice notice-error">Renewal payments failed, so the subscription is paused. Subscribe again to restore your plan.</p>
      )}

      <section aria-labelledby="plans-h" style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
        <div className="section-head">
          <span className="section-icon"><Receipt /></span>
          <div>
            <h2 id="plans-h" className="section-title">Plans</h2>
            <p>Billed monthly in rupees, plus applicable taxes. Cancel anytime.</p>
          </div>
        </div>
        {!data.billingAvailable && (
          <p className="notice notice-warning">Online payments aren’t switched on yet. Contact us to start a paid plan.</p>
        )}
        <div className="price-grid" style={{ margin: 0, maxWidth: 'none', width: '100%' }}>
          {data.plans.map((p, i) => {
            const current = (e.source === 'subscription' && e.planId === p.id) || (p.id === 'trial' && e.source === 'trial');
            return (
              <Reveal key={p.id} delay={i * 80} className={`price-card spot ${current ? 'current' : p.id === 'creator' ? 'featured' : ''}`}>
                {current ? <span className="tag green">Current plan</span> : p.id === 'creator' ? <span className="tag">Most popular</span> : null}
                <span className="eyebrow">{p.name}</span>
                <p className="amount">{p.pricePaise ? inr(p.pricePaise) : '₹0'}<small>{p.interval === 'month' ? ' / month' : ' · one-time'}</small></p>
                <p className="text-muted" style={{ fontSize: '0.84rem' }}>{p.blurb}</p>
                <ul>
                  <li><Check size={14} /> {p.sourceMinutes} minutes of recordings{p.interval === 'month' ? ' a month' : ''}</li>
                  <li><Check size={14} /> {p.exports} video exports{p.interval === 'month' ? ' a month' : ''}</li>
                  <li><Check size={14} /> Recordings up to {p.maxSourceMinutes} min · {p.maxUploadMb >= 1000 ? `${p.maxUploadMb / 1000} GB` : `${p.maxUploadMb} MB`}</li>
                  <li><Check size={14} /> Files kept {p.retentionDays} days</li>
                  <li><Check size={14} /> Edit, download, publish to YouTube</li>
                </ul>
                {p.id !== 'trial' && !current && (
                  <button type="button" className="btn btn-primary btn-lg" disabled={!data.billingAvailable || !data.canManage || !!busy || !!activeSub && !sub!.cancelAtPeriodEnd} onClick={() => subscribe(p.id)}>
                    {busy === p.id ? <RefreshCw size={14} className="animate-spin" /> : <CreditCard size={14} />} Subscribe
                  </button>
                )}
              </Reveal>
            );
          })}
        </div>
        {!data.canManage && <p className="text-subtle" style={{ fontSize: '0.75rem' }}>Only the workspace owner can change the plan.</p>}
        <p className="text-subtle" style={{ fontSize: '0.75rem', display: 'flex', gap: '0.4rem', alignItems: 'flex-start' }}>
          <ShieldCheck size={13} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>Payments are processed securely by Razorpay (UPI, cards, netbanking). Prices exclude applicable taxes. See our <a className="link" href="/refunds">refund policy</a>.</span>
        </p>
      </section>
    </div>
  );
}
