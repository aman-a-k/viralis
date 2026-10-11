"use client";

import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Check, CreditCard, RefreshCw } from 'lucide-react';
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

function Meter({ label, used, limit, unit }: { label: string; used: number; limit: number; unit: string }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 100;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
        <span>{label}</span>
        <span className="tnum text-muted">{used} / {limit} {unit}</span>
      </div>
      <div className={`progress ${pct >= 90 ? 'progress-warn' : ''}`} role="progressbar" aria-label={label} aria-valuenow={used} aria-valuemin={0} aria-valuemax={limit}>
        <div style={{ width: `${pct}%` }} />
      </div>
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

  if (!data) return <div className="panel empty-state"><RefreshCw className="animate-spin" size={20} aria-label="Loading" /></div>;
  const { entitlement: e, subscription: sub } = data;
  const activeSub = sub && ['active', 'pending'].includes(sub.status);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <section className="panel-card" aria-labelledby="usage-h" style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
          <h2 id="usage-h" className="section-title">
            {e.source === 'unlimited' ? 'Internal account (unmetered)' : e.source === 'subscription' ? `${e.planName} plan` : e.source === 'trial' ? 'Free trial' : 'No active plan'}
          </h2>
          <span className="text-subtle" style={{ fontSize: '0.78rem' }}>
            {e.source === 'subscription' && e.periodEnd
              ? sub?.cancelAtPeriodEnd
                ? `Ends ${fmtDate(e.periodEnd)} — won’t renew`
                : `Renews ${fmtDate(e.periodEnd)}`
              : e.source === 'trial'
                ? 'One-time allowance'
                : ''}
          </span>
        </div>
        {e.source !== 'unlimited' && (
          <div style={{ display: 'grid', gap: '0.9rem', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))' }}>
            <Meter label="Processing time" used={e.used.sourceMinutes} limit={e.limits.sourceMinutes} unit="min" />
            <Meter label="Video exports" used={e.used.exports} limit={e.limits.exports} unit="" />
          </div>
        )}
        <p className="text-subtle" style={{ fontSize: '0.75rem' }}>
          Processing time counts the length of each recording you add. Each video export (including re-exports after edits) counts once. Anything that fails on our side is returned automatically.
        </p>
        {sub?.status === 'pending' && (
          <p className="notice notice-warning">Your last renewal payment failed and is being retried. Update your payment method from the link in Razorpay’s email to avoid losing access.</p>
        )}
        {sub?.status === 'halted' && (
          <p className="notice notice-error">Renewal payments failed, so the subscription is paused. Subscribe again to restore your plan.</p>
        )}
        {activeSub && !sub!.cancelAtPeriodEnd && data.canManage && (
          <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} disabled={busy === 'cancel'} onClick={cancel}>Cancel subscription</button>
        )}
      </section>

      <section aria-labelledby="plans-h" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <h2 id="plans-h" className="section-title">Plans</h2>
        {!data.billingAvailable && (
          <p className="notice notice-warning">Online payments aren’t switched on yet. Contact us to start a paid plan.</p>
        )}
        <div className="plan-grid">
          {data.plans.map((p) => {
            const current = (e.source === 'subscription' && e.planId === p.id) || (p.id === 'trial' && e.source === 'trial');
            return (
              <div key={p.id} className={`panel-card plan-card ${current ? 'current' : ''}`}>
                <span className="eyebrow">{p.name}</span>
                <p className="plan-price">{p.pricePaise ? inr(p.pricePaise) : 'Free'}<span className="text-subtle">{p.interval === 'month' ? ' / month' : ' · once'}</span></p>
                <p className="text-muted" style={{ fontSize: '0.8rem' }}>{p.blurb}</p>
                <ul className="plan-features">
                  <li><Check size={13} /> {p.sourceMinutes} minutes of recordings{p.interval === 'month' ? ' a month' : ''}</li>
                  <li><Check size={13} /> {p.exports} video exports{p.interval === 'month' ? ' a month' : ''}</li>
                  <li><Check size={13} /> Recordings up to {p.maxSourceMinutes} min · {p.maxUploadMb >= 1000 ? `${p.maxUploadMb / 1000} GB` : `${p.maxUploadMb} MB`}</li>
                  <li><Check size={13} /> Files kept {p.retentionDays} days</li>
                  <li><Check size={13} /> Edit, download, publish to YouTube</li>
                </ul>
                {p.id !== 'trial' && (
                  current ? (
                    <span className="badge badge-success" style={{ alignSelf: 'flex-start' }}>Current plan</span>
                  ) : (
                    <button type="button" className="btn btn-primary" disabled={!data.billingAvailable || !data.canManage || !!busy || !!activeSub && !sub!.cancelAtPeriodEnd} onClick={() => subscribe(p.id)}>
                      {busy === p.id ? <RefreshCw size={14} className="animate-spin" /> : <CreditCard size={14} />} Subscribe
                    </button>
                  )
                )}
              </div>
            );
          })}
        </div>
        {!data.canManage && <p className="text-subtle" style={{ fontSize: '0.75rem' }}>Only the workspace owner can change the plan.</p>}
        <p className="text-subtle" style={{ fontSize: '0.75rem' }}>
          Payments are processed by Razorpay (UPI, cards, netbanking). Prices exclude applicable taxes. Cancel anytime; see our <a className="link" href="/refunds">refund policy</a>.
        </p>
      </section>
    </div>
  );
}
