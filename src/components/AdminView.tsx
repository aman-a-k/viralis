"use client";

import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { RefreshCw, CheckCircle2, XCircle } from 'lucide-react';
import { api, errorMessage } from '@/lib/client';

interface Overview {
  config: Record<string, boolean | string>;
  totals: { users: number; newUsers24h: number; workspaces: number };
  subscriptions: { status: string; plan: string; count: number }[];
  jobs24h: { type: string; status: string; count: number }[];
  queue: { type: string; status: string; count: number }[];
  oldestQueued: { createdAt: string; type: string } | null;
  lastWorkerActivity: string | null;
  failedJobs: { id: string; type: string; error: string | null; attempts: number; workspaceId: string; updatedAt: string }[];
  usageThisMonth: { sourceMinutes: number; exports: number };
  audit: { action: string; workspaceId: string | null; userId: string | null; detail: string | null; createdAt: string }[];
}

const ago = (d: string | null) => {
  if (!d) return 'never';
  const m = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};

export function AdminView() {
  const [o, setO] = useState<Overview | null>(null);
  const load = useCallback(() => api<Overview>('/api/admin/overview').then(setO).catch((e) => toast.error(errorMessage(e))), []);
  useEffect(() => {
    load();
  }, [load]);

  const retry = async (jobId: string) => {
    try {
      await api('/api/admin/jobs', { body: { jobId } });
      toast.success('Re-queued.');
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  if (!o) return <div className="panel empty-state"><RefreshCw className="animate-spin" size={20} aria-label="Loading" /></div>;
  const queued = o.queue.filter((q) => q.status === 'queued').reduce((n, q) => n + q.count, 0);
  const running = o.queue.filter((q) => q.status === 'running').reduce((n, q) => n + q.count, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-secondary btn-sm" onClick={load}><RefreshCw size={13} /> Refresh</button>
      </div>

      <div className="grid-metrics">
        {[
          ['Users', `${o.totals.users}`, `+${o.totals.newUsers24h} in 24h`],
          ['Workspaces', `${o.totals.workspaces}`, ''],
          ['Queue', `${queued} waiting · ${running} running`, o.oldestQueued ? `oldest ${ago(o.oldestQueued.createdAt)}` : 'empty'],
          ['Worker last claimed', ago(o.lastWorkerActivity), ''],
          ['Usage this month', `${o.usageThisMonth.sourceMinutes} min`, `${o.usageThisMonth.exports} exports`],
        ].map(([label, value, foot]) => (
          <div key={label} className="stat-card">
            <span className="stat-label">{label}</span>
            <span className="stat-value" style={{ fontSize: '1.15rem' }}>{value}</span>
            {foot && <span className="stat-foot">{foot}</span>}
          </div>
        ))}
      </div>

      <section className="panel-card settings-section">
        <h2 className="section-title">Configuration</h2>
        <ul className="config-list">
          {Object.entries(o.config).map(([k, v]) => (
            <li key={k}>
              {v === false || v === 'not configured' ? <XCircle size={14} color="var(--red)" /> : <CheckCircle2 size={14} color="var(--green)" />}
              <span>{k}</span>
              {typeof v === 'string' && <span className="text-subtle">{v}</span>}
            </li>
          ))}
        </ul>
      </section>

      <section className="panel-card settings-section">
        <h2 className="section-title">Subscriptions</h2>
        {o.subscriptions.length === 0 ? <p className="text-subtle" style={{ fontSize: '0.8rem' }}>None yet.</p> : (
          <div className="table-scroll"><table className="data-table"><thead><tr><th>Plan</th><th>Status</th><th>Count</th></tr></thead>
            <tbody>{o.subscriptions.map((s) => <tr key={`${s.plan}-${s.status}`}><td>{s.plan}</td><td>{s.status}</td><td className="tnum">{s.count}</td></tr>)}</tbody></table></div>
        )}
      </section>

      <section className="panel-card settings-section">
        <h2 className="section-title">Jobs (last 24h)</h2>
        <div className="table-scroll"><table className="data-table"><thead><tr><th>Type</th><th>Status</th><th>Count</th></tr></thead>
          <tbody>{o.jobs24h.map((j) => <tr key={`${j.type}-${j.status}`}><td>{j.type}</td><td>{j.status}</td><td className="tnum">{j.count}</td></tr>)}</tbody></table></div>
      </section>

      <section className="panel-card settings-section">
        <h2 className="section-title">Recent failures</h2>
        {o.failedJobs.length === 0 ? <p className="text-subtle" style={{ fontSize: '0.8rem' }}>No failed jobs.</p> : (
          <div className="table-scroll"><table className="data-table"><thead><tr><th>When</th><th>Type</th><th>Error</th><th>Tries</th><th /></tr></thead>
            <tbody>{o.failedJobs.map((j) => (
              <tr key={j.id}><td>{ago(j.updatedAt)}</td><td>{j.type}</td><td style={{ maxWidth: 380 }}>{j.error}</td><td className="tnum">{j.attempts}</td>
                <td><button type="button" className="btn btn-ghost btn-sm" onClick={() => retry(j.id)}>Retry</button></td></tr>
            ))}</tbody></table></div>
        )}
      </section>

      <section className="panel-card settings-section">
        <h2 className="section-title">Audit trail</h2>
        <div className="table-scroll"><table className="data-table"><thead><tr><th>When</th><th>Action</th><th>Detail</th></tr></thead>
          <tbody>{o.audit.map((a, i) => <tr key={i}><td>{ago(a.createdAt)}</td><td>{a.action}</td><td style={{ maxWidth: 420, wordBreak: 'break-word' }} className="text-subtle">{a.detail}</td></tr>)}</tbody></table></div>
      </section>
    </div>
  );
}
