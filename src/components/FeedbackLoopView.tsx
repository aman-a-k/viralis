"use client";

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { FeedbackLoopData } from '@/types';
import {
  RefreshCw, AlertTriangle, CheckCircle2, Zap, Target, Sparkles, HelpCircle, Eye, BarChart3,
} from 'lucide-react';

function SampleBadge() {
  return <span className="badge badge-warning" style={{ fontSize: '0.6875rem' }}>Sample</span>;
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-subtle" style={{ fontSize: '0.8125rem', padding: '0.75rem 0' }}>{children}</p>
  );
}

function SampleRetentionChart() {
  return (
    <div className="panel-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '0.5rem' }}>
        <div>
          <h3 style={{ fontSize: '0.9375rem', fontWeight: 700 }}>Audience Retention Curve (0–60s)</h3>
          <p className="text-subtle" style={{ fontSize: '0.75rem' }}>What a per-second retention curve will look like here</p>
        </div>
        <SampleBadge />
      </div>

      <div style={{ width: '100%', height: '180px', position: 'relative' }}>
        <svg viewBox="0 0 500 160" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
          <defs>
            <linearGradient id="viralisGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid Lines */}
          <line x1="0" y1="30" x2="500" y2="30" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
          <line x1="0" y1="80" x2="500" y2="80" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
          <line x1="0" y1="130" x2="500" y2="130" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />

          {/* Baseline curve (gray) */}
          <path
            d="M 0,40 Q 60,110 160,125 T 350,135 T 500,145"
            fill="none"
            stroke="#52525b"
            strokeWidth="2"
            strokeDasharray="4 4"
          />

          {/* Viralis Curve (indigo area + stroke) */}
          <path
            d="M 0,25 Q 70,35 160,50 T 350,70 T 500,80 L 500,160 L 0,160 Z"
            fill="url(#viralisGrad)"
          />
          <path
            d="M 0,25 Q 70,35 160,50 T 350,70 T 500,80"
            fill="none"
            stroke="#6366f1"
            strokeWidth="2.5"
          />

          {/* Drop-off marker */}
          <circle cx="50" cy="32" r="4" fill="#10b981" />
          <text x="60" y="28" fill="#10b981" fontSize="10" fontWeight="700">3s Hook Retained (+88%)</text>
        </svg>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem', color: 'var(--foreground-subtle)', marginTop: '0.5rem', borderTop: '1px solid var(--surface-border-subtle)', paddingTop: '0.5rem' }}>
        <span>0s</span>
        <span>15s</span>
        <span>30s</span>
        <span>45s</span>
        <span>60s</span>
      </div>
    </div>
  );
}

function SampleWeights({ weights }: { weights: NonNullable<FeedbackLoopData['modelWeightAdjustments']> }) {
  const rows = [
    { label: 'Hook Velocity (0–3s)', value: `+${weights.hookSpeedWeight}%`, width: '78%', color: '#10b981' },
    { label: 'Emotional Intensity', value: `+${weights.emotionalIntensityWeight}%`, width: '68%', color: '#6366f1' },
    { label: 'Controversy Factor', value: `${weights.controversyWeight}%`, width: '42%', color: '#f59e0b' },
    { label: 'Core Niche Relevance', value: `+${weights.nicheTopicRelevance}%`, width: '85%', color: '#3b82f6' },
  ];
  return (
    <div className="panel-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', gap: '0.5rem' }}>
        <h3 style={{ fontSize: '0.9375rem', fontWeight: 700 }}>Scoring Weight Recalibration</h3>
        <SampleBadge />
      </div>
      <p className="text-subtle" style={{ fontSize: '0.75rem', marginBottom: '1rem' }}>
        Planned: shifting what the highlight analyzer prioritizes based on your retention data. Not active yet.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        {rows.map((r) => (
          <div key={r.label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>
              <span>{r.label}</span>
              <span style={{ color: r.color }}>{r.value}</span>
            </div>
            <div style={{ width: '100%', height: '5px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ width: r.width, height: '100%', background: r.color }}></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FeedbackLoopView() {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
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
      toast.error('Could not load Learning Loop data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoopData();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '3.5rem', textAlign: 'center' }}>
        <RefreshCw className="animate-spin" size={24} color="var(--primary)" style={{ margin: '0 auto 0.75rem auto' }} />
        <p className="text-muted" style={{ fontSize: '0.8125rem' }}>Loading performance data...</p>
      </div>
    );
  }

  if (failed || !feedbackData) {
    return (
      <div className="panel-card" style={{ textAlign: 'center', padding: '2.5rem' }}>
        <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>Couldn&apos;t load Learning Loop data.</p>
        <button onClick={fetchLoopData} className="btn btn-secondary" style={{ fontSize: '0.75rem' }}>
          <RefreshCw size={13} /> Try again
        </button>
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {isSampleData && (
        <div className="panel-card" style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', borderColor: 'var(--yellow-line, #f59e0b40)' }}>
          <HelpCircle size={16} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-2)' }}>
            <strong>Sample data.</strong> No published clips have performance metrics yet, so everything below is an illustrative preview of this page — not your account&apos;s results.
          </p>
        </div>
      )}

      <div className="panel-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <p className="text-muted" style={{ fontSize: '0.8125rem', maxWidth: '720px' }}>
            How your published clips actually perform: average watch-through, which hook styles hold viewers, and which clips lost them.
          </p>
        </div>
        <button onClick={fetchLoopData} className="btn btn-secondary" style={{ fontSize: '0.75rem' }}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      <div className="grid-metrics">
        <div className="panel-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span className="text-subtle" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Avg. watch-through</span>
            <Target size={15} color="#10b981" />
          </div>
          <p style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--foreground)' }}>{overallWatchThrough}%</p>
        </div>
        <div className="panel-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span className="text-subtle" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Clips measured</span>
            <BarChart3 size={15} color="var(--primary)" />
          </div>
          <p style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--foreground)' }}>{isSampleData ? '—' : clipsMeasured}</p>
        </div>
        <div className="panel-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span className="text-subtle" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Total views</span>
            <Eye size={15} color="#3b82f6" />
          </div>
          <p style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--foreground)' }}>{isSampleData ? '—' : totalViews.toLocaleString()}</p>
        </div>
      </div>

      {isSampleData && modelWeightAdjustments && (
        <div className="grid-cols-2" style={{ gap: '1.25rem' }}>
          <SampleRetentionChart />
          <SampleWeights weights={modelWeightAdjustments} />
        </div>
      )}

      <div className="grid-cols-2" style={{ gap: '1.25rem' }}>
        <div className="panel-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
            <AlertTriangle size={15} color="#f59e0b" />
            <h3 style={{ fontSize: '0.9375rem', fontWeight: 700 }}>Clips that lost viewers</h3>
          </div>
          <p className="text-subtle" style={{ fontSize: '0.75rem', marginBottom: '1rem' }}>
            Published clips under 55% watch-through, lowest first.
          </p>
          {underperformingClips.length === 0 ? (
            <EmptyNote>No measured clip is under 55% watch-through.</EmptyNote>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {underperformingClips.map((item, idx) => (
                <div key={idx} style={{ padding: '0.75rem 0.9rem', background: 'var(--surface-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--surface-border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.clipTitle}</span>
                    <span className="badge badge-danger" style={{ fontSize: '0.625rem', flexShrink: 0 }}>
                      {item.watchThrough}% · {item.platform}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: '#fbbf24', marginTop: '0.25rem', fontWeight: 500 }}>
                    {item.rootCause}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
            <CheckCircle2 size={15} color="#10b981" />
            <h3 style={{ fontSize: '0.9375rem', fontWeight: 700 }}>Hook styles that hold viewers</h3>
          </div>
          <p className="text-subtle" style={{ fontSize: '0.75rem', marginBottom: '1rem' }}>
            Average watch-through by the hook style the analyzer picked.
          </p>
          {highPerformingHooks.length === 0 ? (
            <EmptyNote>Not enough measured clips yet.</EmptyNote>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {highPerformingHooks.map((hook, idx) => (
                <div key={idx} style={{ padding: '0.75rem 0.9rem', background: 'rgba(16, 185, 129, 0.05)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(16, 185, 129, 0.18)', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <Zap size={14} color="#10b981" style={{ marginTop: '0.1rem', flexShrink: 0 }} />
                  <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--foreground)' }}>{hook}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {isSampleData && backCatalogSuggestions.length > 0 && (
        <div className="panel-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', gap: '0.5rem' }}>
            <div>
              <h3 style={{ fontSize: '0.9375rem', fontWeight: 700 }}>Back-catalog matches</h3>
              <p className="text-subtle" style={{ fontSize: '0.75rem' }}>
                Planned: moments from past videos that fit what&apos;s trending now.
              </p>
            </div>
            <SampleBadge />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '1rem' }}>
            {backCatalogSuggestions.map((item, idx) => (
              <div key={idx} className="panel-card" style={{ background: 'var(--surface-subtle)', padding: '1rem' }}>
                <span className="text-subtle" style={{ fontSize: '0.6875rem', fontWeight: 600 }}>
                  From: {item.projectTitle} • {item.timestamp}
                </span>
                <h4 style={{ fontSize: '0.8125rem', fontWeight: 700, marginTop: '0.25rem' }}>
                  <Sparkles size={12} style={{ display: 'inline', marginRight: 4 }} />
                  {item.suggestedAngle}
                </h4>
                <p style={{ fontSize: '0.75rem', color: '#60a5fa', marginTop: '0.35rem', fontWeight: 500 }}>
                  {item.matchingTrend}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
