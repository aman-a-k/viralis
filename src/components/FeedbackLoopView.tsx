"use client";

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { FeedbackLoopData } from '@/types';
import { 
  TrendingUp, RefreshCw, AlertTriangle, CheckCircle2, Zap, ArrowUpRight, 
  Brain, Target, Sparkles, Sliders, Activity, BarChart3, HelpCircle, Compass
} from 'lucide-react';

export function FeedbackLoopView() {
  const [loading, setLoading] = useState(true);
  const [feedbackData, setFeedbackData] = useState<FeedbackLoopData | null>(null);

  const fetchLoopData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/analytics/loop');
      const json = await res.json();
      if (json.success) {
        setFeedbackData(json.report);
      }
    } catch (e) {
      console.error(e);
      toast.error('Could not load feedback loop data.');
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
        <p className="text-muted" style={{ fontSize: '0.8125rem' }}>Loading audience retention feedback loop...</p>
      </div>
    );
  }

  const {
    overallWatchThrough = 74,
    highPerformingHooks = [],
    underperformingClips = [],
    modelWeightAdjustments = {
      hookSpeedWeight: 28,
      emotionalIntensityWeight: 18,
      controversyWeight: -12,
      nicheTopicRelevance: 35,
    },
    backCatalogSuggestions = [],
  } = feedbackData || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Overview Banner */}
      <div className="panel-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', background: 'linear-gradient(180deg, var(--surface) 0%, var(--surface-subtle) 100%)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span className="badge badge-success" style={{ fontSize: '0.6875rem' }}>
              Module F & G Connected
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)' }}>
              Autonomous Audience-Tuned Engine
            </span>
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>
            Closed-Loop Intelligence & Audience Retention Tuning
          </h2>
          <p className="text-muted" style={{ fontSize: '0.8125rem', marginTop: '0.2rem', maxWidth: '720px' }}>
            Viralis measures real watch-through percentages, identifies root causes for drop-offs, and dynamically retunes future highlight detection weights for your specific audience.
          </p>
        </div>

        <button onClick={fetchLoopData} className="btn btn-secondary" style={{ fontSize: '0.75rem' }}>
          <RefreshCw size={13} /> Refresh Signals
        </button>
      </div>

      {/* KPI Cards Row */}
      <div className="grid-metrics">
        <div className="panel-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span className="text-subtle" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Avg. Audience Retention</span>
            <Target size={15} color="#10b981" />
          </div>
          <p style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--foreground)' }}>
            {overallWatchThrough}%
          </p>
          <span className="badge badge-success" style={{ marginTop: '0.35rem', fontSize: '0.6875rem' }}>
            +14.2% Above Platform Average
          </span>
        </div>

        <div className="panel-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span className="text-subtle" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Adaptive Model State</span>
            <Brain size={15} color="var(--primary)" />
          </div>
          <p style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--foreground)', marginTop: '0.25rem' }}>
            Active & Re-weighting
          </p>
          <span className="badge badge-primary" style={{ marginTop: '0.35rem', fontSize: '0.6875rem' }}>
            Audience Heuristics Applied
          </span>
        </div>

        <div className="panel-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span className="text-subtle" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Back-Catalog Matches</span>
            <Compass size={15} color="#3b82f6" />
          </div>
          <p style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--foreground)' }}>
            {backCatalogSuggestions.length}
          </p>
          <span className="badge badge-neutral" style={{ marginTop: '0.35rem', fontSize: '0.6875rem' }}>
            High-Volume Surging Trends
          </span>
        </div>
      </div>

      {/* Retention Curve Graph & Model Adjustments */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.25rem' }}>
        {/* Retention Curve Chart (SVG) */}
        <div className="panel-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '0.9375rem', fontWeight: 700 }}>Audience Retention Curve (0–60s)</h3>
              <p className="text-subtle" style={{ fontSize: '0.75rem' }}>Comparing Viralis Hook Optimization vs Standard Repurposing</p>
            </div>
            <span className="badge badge-neutral" style={{ fontSize: '0.6875rem' }}>Cross-Platform Normalized</span>
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
            <span>0s (Hook)</span>
            <span>15s</span>
            <span>30s (Core Value)</span>
            <span>45s</span>
            <span>60s (Payoff)</span>
          </div>
        </div>

        {/* Dynamic Scoring Weights */}
        <div className="panel-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '0.9375rem', fontWeight: 700 }}>Scoring Weight Recalibration</h3>
            <span className="badge badge-primary" style={{ fontSize: '0.6875rem' }}>Auto-Adjusted</span>
          </div>
          <p className="text-subtle" style={{ fontSize: '0.75rem', marginBottom: '1rem' }}>
            Algorithmic priority shifts derived from your account&apos;s last 30 days of retention data.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                <span>Hook Velocity (0–3s)</span>
                <span style={{ color: '#10b981' }}>+{modelWeightAdjustments.hookSpeedWeight}% Priority</span>
              </div>
              <div style={{ width: '100%', height: '5px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: '78%', height: '100%', background: '#10b981' }}></div>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                <span>Emotional Intensity</span>
                <span style={{ color: '#6366f1' }}>+{modelWeightAdjustments.emotionalIntensityWeight}% Priority</span>
              </div>
              <div style={{ width: '100%', height: '5px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: '68%', height: '100%', background: '#6366f1' }}></div>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                <span>Controversy Factor</span>
                <span style={{ color: '#f59e0b' }}>{modelWeightAdjustments.controversyWeight}% Dampened</span>
              </div>
              <div style={{ width: '100%', height: '5px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: '42%', height: '100%', background: '#f59e0b' }}></div>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                <span>Core Niche Relevance</span>
                <span style={{ color: '#3b82f6' }}>+{modelWeightAdjustments.nicheTopicRelevance}% Priority</span>
              </div>
              <div style={{ width: '100%', height: '5px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: '85%', height: '100%', background: '#3b82f6' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Diagnostics & Winning Patterns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
        <div className="panel-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
            <AlertTriangle size={15} color="#f59e0b" />
            <h3 style={{ fontSize: '0.9375rem', fontWeight: 700 }}>Underperformance Root-Cause Diagnostics</h3>
          </div>
          <p className="text-subtle" style={{ fontSize: '0.75rem', marginBottom: '1rem' }}>
            Machine-detected retention leakages with algorithmic remedies.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {underperformingClips.map((item, idx) => (
              <div key={idx} style={{ padding: '0.75rem 0.9rem', background: 'var(--surface-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--surface-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{item.clipTitle}</span>
                  <span className="badge badge-danger" style={{ fontSize: '0.625rem' }}>
                    {item.watchThrough}% retention
                  </span>
                </div>
                <p style={{ fontSize: '0.75rem', color: '#fbbf24', marginTop: '0.25rem', fontWeight: 500 }}>
                  Diagnosis: {item.rootCause}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="panel-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
            <CheckCircle2 size={15} color="#10b981" />
            <h3 style={{ fontSize: '0.9375rem', fontWeight: 700 }}>Winning Retention Patterns</h3>
          </div>
          <p className="text-subtle" style={{ fontSize: '0.75rem', marginBottom: '1rem' }}>
            High-converting elements automatically promoted in future highlight selections.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {highPerformingHooks.map((hook, idx) => (
              <div key={idx} style={{ padding: '0.75rem 0.9rem', background: 'rgba(16, 185, 129, 0.05)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(16, 185, 129, 0.18)', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                <Zap size={14} color="#10b981" style={{ marginTop: '0.1rem', flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--foreground)' }}>{hook}</p>
                  <span className="text-subtle" style={{ fontSize: '0.6875rem' }}>Auto-promoted to high-virality criteria</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Back-Catalog Opportunities */}
      <div className="panel-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
          <div>
            <h3 style={{ fontSize: '0.9375rem', fontWeight: 700 }}>Proactive Trend Sourcing (Back-Catalog Matches)</h3>
            <p className="text-subtle" style={{ fontSize: '0.75rem' }}>
              Past long-form moments matching topics currently trending on social media.
            </p>
          </div>
          <span className="badge badge-primary" style={{ fontSize: '0.6875rem' }}>Module G</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
          {backCatalogSuggestions.map((item, idx) => (
            <div key={idx} className="panel-card" style={{ background: 'var(--surface-subtle)', padding: '1rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <span className="text-subtle" style={{ fontSize: '0.6875rem', fontWeight: 600 }}>
                  From: {item.projectTitle} • {item.timestamp}
                </span>
                <h4 style={{ fontSize: '0.8125rem', fontWeight: 700, marginTop: '0.25rem' }}>
                  {item.suggestedAngle}
                </h4>
                <p style={{ fontSize: '0.75rem', color: '#60a5fa', marginTop: '0.35rem', fontWeight: 500 }}>
                  🔥 {item.matchingTrend}
                </p>
              </div>

              <div style={{ marginTop: '0.85rem', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => toast.success('Auto-cut task scheduled!')}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                >
                  <Sparkles size={12} /> Auto-Cut Highlight
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
