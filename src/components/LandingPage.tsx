"use client";

import React from 'react';
import { Zap, Scissors, Sparkles, Brain, ClipboardCheck, ArrowRight } from 'lucide-react';

interface LandingPageProps {
  onSignIn: () => void;
}

const FEATURES = [
  {
    icon: Scissors,
    title: 'Repurpose Studio',
    description: 'Turn one long-form video into ten high-retention 9:16 shorts with automated face tracking and dynamic subtitles.',
  },
  {
    icon: Sparkles,
    title: 'Autopilot Generator',
    description: 'Scan trending topics and autonomously write, voice, and render 4K short-form videos — no editing required.',
  },
  {
    icon: ClipboardCheck,
    title: 'Approval Queue',
    description: 'A human-in-the-loop review workflow so nothing publishes to your channels without a final check.',
  },
  {
    icon: Brain,
    title: 'Learning Loop',
    description: 'Closed-loop audience retention metrics that re-weight highlight selection based on what actually performs.',
  },
];

export function LandingPage({ onSignIn }: LandingPageProps) {
  return (
    <div className="landing">
      <a href="#landing-main" className="skip-link">Skip to content</a>

      <nav className="landing-nav">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{ width: '30px', height: '30px', borderRadius: '9px', background: 'var(--gradient-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 16px -2px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,0.25)' }}>
            <Zap size={17} color="#fff" fill="#fff" />
          </div>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '1.15rem', fontWeight: 700, letterSpacing: '-0.03em', color: '#fff' }}>
            Viralis
          </span>
        </div>

        <button type="button" onClick={onSignIn} className="btn btn-secondary">
          Sign in
        </button>
      </nav>

      <main id="landing-main">
        <div style={{ position: 'relative' }}>
          <div className="landing-glow" aria-hidden="true"></div>
          <div className="landing-hero" style={{ position: 'relative', zIndex: 1 }}>
            <span className="badge badge-primary" style={{ fontSize: '0.75rem' }}>
              Dual-Engine Content Automation
            </span>
            <h1>Go viral, on autopilot.</h1>
            <p>
              Viralis turns long-form video into a self-optimizing content engine — automatically
              extracting viral highlights, reframing to 9:16 with dynamic captions, and learning
              from performance data with every publish.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button type="button" onClick={onSignIn} className="btn btn-primary" style={{ padding: '0.7rem 1.5rem', fontSize: '0.9375rem' }}>
                Get started <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </div>

        <section className="landing-section" aria-label="Features">
          <div className="landing-features">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div className="landing-feature-card" key={f.title}>
                  <div className="landing-feature-icon" aria-hidden="true">
                    <Icon size={18} />
                  </div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>{f.title}</h3>
                  <p className="text-muted" style={{ fontSize: '0.8125rem', lineHeight: 1.55 }}>
                    {f.description}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="landing-section" aria-label="Overview">
          <div className="panel-card" style={{ background: 'linear-gradient(180deg, var(--surface) 0%, var(--surface-subtle) 100%)', textAlign: 'center', padding: 'clamp(1.5rem, 5vw, 3rem)' }}>
            <h2 style={{ fontSize: 'clamp(1.25rem, 3vw, 1.75rem)', fontWeight: 800, marginBottom: '0.75rem' }}>
              One engine. Every platform.
            </h2>
            <p className="text-muted" style={{ fontSize: '0.9375rem', maxWidth: '640px', margin: '0 auto 1.5rem', lineHeight: 1.6 }}>
              Sign in to connect YouTube and Instagram, set your brand voice, and let the
              multi-agent pipeline handle discovery, editing, and distribution end to end.
            </p>
            <button type="button" onClick={onSignIn} className="btn btn-primary" style={{ padding: '0.65rem 1.75rem' }}>
              Get started <ArrowRight size={15} />
            </button>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <span>© {new Date().getFullYear()} Viralis. AI Video Repurposing &amp; Distribution.</span>
      </footer>
    </div>
  );
}

