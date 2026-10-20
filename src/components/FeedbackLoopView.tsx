"use client";

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { FeedbackLoopData } from '@/types';
import {
  RefreshCw, AlertTriangle, Zap, Target, Sparkles, Eye, BarChart3, MonitorPlay, Activity, SlidersHorizontal, Info,
} from 'lucide-react';
import { CountUp, Reveal } from './motion';

function SampleBadge() {
  return <span className="badge badge-warning">Sample</span>;
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="text-subtle" style={{ fontSize: '0.8125rem', padding: '0.75rem 0' }}>{children}</p>;
}

function SampleRetentionChart() {
  // Viralis-picked clips vs a typical baseline, 0–60s. Illustrative only.
  const ours = 'M 0,25 C 60,30 110,44 160,50 S 300,66 350,70 S 450,78 500,80';
  const base = 'M 0,40 C 50,95 100,118 160,125 S 300,134 350,135 S 450,143 500,145';
  return (
    <Reveal className="panel-card">
      <div className="section-head" style={{ marginBottom: '1rem' }}>
        <span className="section-icon"><Activity /></span>
        <div>
          <h3 className="section-title">Audience retention (0–60s)</h3>
          <p>What a per-second retention curve will look like here.</p>
        </div>
        <SampleBadge />
      </div>
      <div className="chart-draw" style={{ width: '100%', height: 180 }}>
        <svg viewBox="0 0 500 160" preserveAspectRatio="none" style={{ width: '100%', height: '100%', overflow: 'visible' }} aria-hidden="true">
          <defs>
            <linearGradient id="ret-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(255,90,31,0.28)" />
              <stop offset="100%" stopColor="rgba(255,90,31,0)" />
            </linearGradient>
          </defs>
          {[30, 80, 130].map((y) => <line key={y} x1="0" y1={y} x2="500" y2={y} stroke="var(--border)" strokeDasharray="3 4" />)}
          <path d={`${ours} L 500,160 L 0,160 Z`} fill="url(#ret-fill)" />
          <path className="line" d={base} fill="none" stroke="var(--text-3)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          <path className="line" d={ours} fill="none" stroke="var(--accent)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem', color: 'var(--text-3)', marginTop: '0.5rem', borderTop: '1px solid var(--border)', paddingTop: '0.5rem' }}>
        <span>0s</span><span>15s</span><span>30s</span><span>45s</span><span>60s</span>
      </div>
      <div style={{ display: 'flex', gap: '1rem', marginTop: '0.6rem', fontSize: '0.72rem', color: 'var(--text-2)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><i style={{ width: 14, height: 3, borderRadius: 2, background: 'var(--accent)' }} /> Your clips</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><i style={{ width: 14, height: 3, borderRadius: 2, background: 'var(--text-3)' }} /> Typical short</span>
      </div>
    </Reveal>
  );
}

function SampleWeights({ weights }: { weights: NonNullable<FeedbackLoopData['modelWeightAdjustments']> }) {
  const rows = [
    { label: 'Hook speed (0–3s)', value: weights.hookSpeedWeight, width: 78 },
    { label: 'Emotional intensity', value: weights.emotionalIntensityWeight, width: 68 },
    { label: 'Controversy', value: weights.controversyWeight, width: 42 },
    { label: 'Niche relevance', value: weights.nicheTopicRelevance, width: 85 },
  ];
  return (
    <Reveal className="panel-card" delay={80}>
      <div className="section-head" style={{ marginBottom: '1rem' }}>
        <span className="section-icon neutral"><SlidersHorizontal /></span>
        <div>
          <h3 className="section-title">What the analyzer will favour</h3>
          <p>Planned: shifting clip picks toward what holds your viewers. Not active yet.</p>
        </div>
        <SampleBadge />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.95rem' }}>
        {rows.map((r, i) => (
          <div key={r.label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              <span>{r.label}</span>
              <span className="tnum" style={{ color: r.value >= 0 ? 'var(--accent-hover)' : 'var(--text-3)' }}>{r.value >= 0 ? '+' : ''}{r.value}%</span>
            </div>
            <div className="weight-bar">
              <div style={{ ['--w' as string]: `${r.width}%`, transitionDelay: `${i * 90}ms`, background: r.value >= 0 ? 'var(--accent)' : 'var(--text-3)' }} />
            </div>
          </div>
        ))}
      </div>
    </Reveal>
  );
}

function Skeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }} role="status" aria-label="Loading performance data">
      <div className="skeleton" style={{ height: 76, borderRadius: 13 }} />
      <div className="grid-metrics">{[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 110, borderRadius: 13 }} />)}</div>
      <div className="grid-cols-2">{[0, 1].map((i) => <div key={i} className="skeleton" style={{ height: 220, borderRadius: 13 }} />)}</div>
    </div>
  );
}

export function FeedbackLoopView() {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [feedbackData, setFeedbackData] = useState<FeedbackLoopData | null>(null);

  const fetchLoopData = async () => {
    try {
      setLoading(true);
      setFailed(false);
      const res = await fetch('/api/analytics/loop');
      const json = await res.json();
      if (json.success) {
        setFeedbackData(json.report);
      } else {
        setFailed(true);
      }
    } catch (e) {
      console.error(e);
      setFailed(true);
      toast.error('Could not load performance data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    fetch('/api/analytics/loop')
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (json.success) setFeedbackData(json.report);
        else setFailed(true);
      })
      .catch(() => !cancelled && setFailed(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const syncNow = async () => {
    setSyncing(true);
    toast.loading('Pulling the latest numbers from YouTube…', { id: 'sync' });
    try {
      const res = await fetch('/api/analytics/sync', { method: 'POST' });
      const data = await res.json();
      if (!data.success) {
        toast.error(data.error || 'Sync failed.', { id: 'sync', duration: 8000 });
      } else if (data.videosChecked === 0) {
        toast('Nothing to sync yet — publish a clip to YouTube first.', { id: 'sync' });
      } else {
        toast.success(`Updated ${data.snapshotsSaved} clip${data.snapshotsSaved === 1 ? '' : 's'}.`, { id: 'sync' });
        if (data.retentionNote) toast(data.retentionNote, { duration: 10000, icon: 'ℹ️' });
        await fetchLoopData();
      }
    } catch {
      toast.error('Network error while syncing.', { id: 'sync' });
    } finally {
      setSyncing(false);
    }
  };

  if (loading) return <Skeleton />;

  if (failed || !feedbackData) {
    return (
      <div className="panel empty-state">
        <span className="section-icon red" style={{ width: 44, height: 44, borderRadius: 12 }}><AlertTriangle /></span>
        <p className="text-muted" style={{ fontSize: '0.875rem' }}>Couldn’t load performance data.</p>
        <button onClick={fetchLoopData} className="btn btn-secondary btn-sm"><RefreshCw size={13} /> Try again</button>
      </div>
    );
  }

  const {
    isSampleData,
    overallWatchThrough,
    clipsMeasured,
    totalViews,
    highPerformingHooks,
    underperformingClips,
    modelWeightAdjustments,
    backCatalogSuggestions,
  } = feedbackData;

  const metrics: { label: string; icon: React.ElementType; value: number | null; suffix?: string; foot: string }[] = [
    {
      label: 'Avg. watch-through', icon: Target, value: isSampleData ? null : overallWatchThrough, suffix: '%',
      foot: isSampleData ? 'after you publish' : overallWatchThrough === null ? 'needs YouTube Analytics — reconnect in Settings' : 'across measured clips',
    },
    { label: 'Clips measured', icon: BarChart3, value: isSampleData ? null : clipsMeasured, foot: 'published clips with stats' },
    { label: 'Total views', icon: Eye, value: isSampleData ? null : totalViews, foot: 'latest YouTube numbers' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <section className="panel-card page-toolbar">
        <div className="section-head">
          <span className="section-icon"><MonitorPlay /></span>
          <div>
            <h2 className="section-title">Learning loop</h2>
            <p>Average watch-through, which hook styles hold viewers, and which clips lost them.</p>
          </div>
        </div>
        <div className="tools">
          <button onClick={fetchLoopData} className="btn btn-secondary btn-sm"><RefreshCw size={13} /> Refresh</button>
          <button onClick={syncNow} disabled={syncing} className="btn btn-primary btn-sm">
            <RefreshCw size={13} className={syncing ? 'animate-spin' : undefined} /> Sync from YouTube
          </button>
        </div>
      </section>

      {isSampleData && (
        <div className="notice notice-warning">
          <Info size={15} />
          <span><strong>Preview.</strong> No published clips have stats yet, so the charts below are an illustrative sample — not your results. Publish a clip to YouTube and sync to see real numbers.</span>
        </div>
      )}

      <div className="grid-metrics stagger" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))' }}>
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <div key={m.label} className="stat-card spot">
              <div className="stat-head"><span className="stat-label">{m.label}</span><span className="stat-icon-tile"><Icon /></span></div>
              <span className="stat-value tnum">{m.value === null ? '—' : <><CountUp value={m.value} />{m.suffix}</>}</span>
              <span className="stat-foot">{m.foot}</span>
            </div>
          );
        })}
      </div>

      {isSampleData && modelWeightAdjustments && (
        <div className="grid-cols-2" style={{ gap: '1.25rem' }}>
          <SampleRetentionChart />
          <SampleWeights weights={modelWeightAdjustments} />
        </div>
      )}

      <div className="grid-cols-2" style={{ gap: '1.25rem' }}>
        <Reveal className="panel-card">
          <div className="section-head" style={{ marginBottom: '1rem' }}>
            <span className="section-icon amber"><AlertTriangle /></span>
            <div>
              <h3 className="section-title">Clips that lost viewers</h3>
              <p>Published clips under 55% watch-through, lowest first.</p>
            </div>
            {isSampleData && <SampleBadge />}
          </div>
          {underperformingClips.length === 0 ? (
            <EmptyNote>No measured clip is under 55% watch-through.</EmptyNote>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
              {underperformingClips.map((item, idx) => (
                <div key={idx} className="list-row" style={{ flexDirection: 'column', gap: '0.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', width: '100%' }}>
                    <span className="truncate" style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{item.clipTitle}</span>
                    <span className="badge badge-danger tnum" style={{ flexShrink: 0 }}>{item.watchThrough}% · {item.platform}</span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--amber)' }}>{item.rootCause}</p>
                </div>
              ))}
            </div>
          )}
        </Reveal>

        <Reveal className="panel-card" delay={80}>
          <div className="section-head" style={{ marginBottom: '1rem' }}>
            <span className="section-icon green"><Zap /></span>
            <div>
              <h3 className="section-title">Hook styles that hold viewers</h3>
              <p>Average watch-through by the hook style the analyzer picked.</p>
            </div>
            {isSampleData && <SampleBadge />}
          </div>
          {highPerformingHooks.length === 0 ? (
            <EmptyNote>Not enough measured clips yet.</EmptyNote>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
              {highPerformingHooks.map((hook, idx) => (
                <div key={idx} className="list-row">
                  <Zap size={14} color="var(--green)" />
                  <p style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{hook}</p>
                </div>
              ))}
            </div>
          )}
        </Reveal>
      </div>

      {isSampleData && backCatalogSuggestions.length > 0 && (
        <Reveal className="panel-card">
          <div className="section-head" style={{ marginBottom: '1rem' }}>
            <span className="section-icon neutral"><Sparkles /></span>
            <div>
              <h3 className="section-title">Back-catalog matches</h3>
              <p>Planned: moments from past recordings that fit what’s trending now.</p>
            </div>
            <SampleBadge />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '0.75rem' }}>
            {backCatalogSuggestions.map((item, idx) => (
              <div key={idx} className="list-row spot" style={{ flexDirection: 'column', gap: '0.3rem' }}>
                <span className="text-subtle" style={{ fontSize: '0.6875rem', fontWeight: 600 }}>From {item.projectTitle} · {item.timestamp}</span>
                <h4 style={{ fontSize: '0.84rem', fontWeight: 700 }}>{item.suggestedAngle}</h4>
                <p style={{ fontSize: '0.75rem', color: 'var(--accent-hover)' }}>{item.matchingTrend}</p>
              </div>
            ))}
          </div>
        </Reveal>
      )}
    </div>
  );
}
