"use client";

import React from 'react';
import { BrandMark } from './BrandMark';
import { Upload, Scissors, Pencil, Download, ArrowRight, Phone, MapPin, Check, Languages, ShieldCheck } from 'lucide-react';
import { PLANS, formatInr } from '@/lib/plans';

interface LandingPageProps {
  onSignIn: () => void;
  onSignUp: () => void;
}

const PHONE_DISPLAY = '93427 39999';
const PHONE_LINK = 'tel:+919342739999';
// A real before/after example recorded with permission. Shown only when set.
const DEMO_VIDEO = process.env.NEXT_PUBLIC_DEMO_VIDEO_URL;

const STEPS = [
  { icon: Upload, title: 'Upload a recording', text: 'A lesson, webinar, interview or talk you recorded — up to 90 minutes.' },
  { icon: Scissors, title: 'Get the best moments', text: 'Viralis reads the whole recording and suggests 3–10 standalone clips, each with captions timed to the speech.' },
  { icon: Pencil, title: 'Fix anything', text: 'Trim the start and end, correct caption words, and choose the framing — crop to the speaker or show the whole slide.' },
  { icon: Download, title: 'Download or publish', text: 'Download vertical, square or wide videos and post them anywhere, or publish straight to YouTube after you approve.' },
];

const PLAN_LIST = Object.values(PLANS).filter((p) => p.available);

export function LandingPage({ onSignIn, onSignUp }: LandingPageProps) {
  return (
    <div className="landing">
      <a href="#landing-main" className="skip-link">Skip to content</a>

      <nav className="landing-nav" aria-label="Site">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <BrandMark size={30} />
          <span style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.03em' }}>Viralis</span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" onClick={onSignIn} className="btn btn-ghost">Sign in</button>
          <button type="button" onClick={onSignUp} className="btn btn-primary">Start free</button>
        </div>
      </nav>

      <main id="landing-main">
        <div style={{ position: 'relative' }}>
          <div className="landing-glow" aria-hidden="true"></div>
          <div className="landing-hero" style={{ position: 'relative', zIndex: 1 }}>
            <span className="badge badge-primary" style={{ fontSize: '0.75rem' }}>For teachers, coaches and creators</span>
            <h1>Turn your weekly lesson or webinar into editable, captioned clips ready to post.</h1>
            <p>
              Upload a recording. Viralis finds the strongest standalone moments, cuts them to vertical, and burns in captions that
              follow every word — in English, Hindi, Kannada and more. You review, edit and download.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button type="button" onClick={onSignUp} className="btn btn-primary btn-lg">
                Try it free on your recording <ArrowRight size={15} />
              </button>
              <a href={PHONE_LINK} className="btn btn-secondary btn-lg"><Phone size={15} /> Call {PHONE_DISPLAY}</a>
            </div>
            <p style={{ fontSize: '0.8125rem', marginTop: '1rem' }} className="text-subtle">
              Free trial: {PLANS.trial.sourceMinutes} minutes of recording and {PLANS.trial.exports} video exports. No card needed.
            </p>
          </div>
        </div>

        {DEMO_VIDEO && (
          <section className="landing-section" aria-label="Example">
            <h2 className="landing-h2">A real example</h2>
            <video src={DEMO_VIDEO} controls preload="metadata" style={{ width: '100%', maxWidth: 820, display: 'block', margin: '0 auto', borderRadius: 'var(--radius-lg)', background: '#000' }} />
          </section>
        )}

        <section className="landing-section" aria-labelledby="how-h">
          <h2 id="how-h" className="landing-h2">How it works</h2>
          <div className="landing-features">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              return (
                <div className="landing-feature-card" key={s.title}>
                  <div className="landing-feature-icon" aria-hidden="true"><Icon size={18} /></div>
                  <span className="text-subtle" style={{ fontSize: '0.6875rem', fontWeight: 700 }}>0{i + 1}</span>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>{s.title}</h3>
                  <p className="text-muted" style={{ fontSize: '0.8125rem', lineHeight: 1.55 }}>{s.text}</p>
                </div>
              );
            })}
          </div>
          <div className="landing-facts">
            <p><Languages size={15} /> Captions in English, Hindi, Kannada, Tamil, Telugu, Malayalam, Marathi, Bengali and more.</p>
            <p><ShieldCheck size={15} /> Your recordings stay private to your workspace and are deleted automatically after your retention period.</p>
            <p><Check size={15} /> Nothing is published without your approval. YouTube publishing is optional.</p>
          </div>
          <p className="text-subtle" style={{ fontSize: '0.75rem', textAlign: 'center', marginTop: '0.75rem' }}>
            Viralis saves you editing time. It can’t promise views — what performs depends on your content and audience.
          </p>
        </section>

        <section className="landing-section" aria-labelledby="pricing-h">
          <h2 id="pricing-h" className="landing-h2">Simple pricing</h2>
          <p className="text-muted" style={{ fontSize: '0.875rem', textAlign: 'center', marginBottom: '1.5rem' }}>
            Billed monthly in rupees, plus applicable taxes. Cancel anytime.
          </p>
          <div className="plan-grid">
            {PLAN_LIST.map((p) => (
              <div key={p.id} className={`panel-card plan-card ${p.id === 'creator' ? 'current' : ''}`}>
                <span className="eyebrow">{p.name}</span>
                <p className="plan-price">{p.pricePaise ? formatInr(p.pricePaise) : 'Free'}<span className="text-subtle">{p.interval === 'month' ? ' / month' : ' · one-time'}</span></p>
                <p className="text-muted" style={{ fontSize: '0.8rem' }}>{p.blurb}</p>
                <ul className="plan-features">
                  <li><Check size={13} /> {p.sourceMinutes} minutes of recordings{p.interval === 'month' ? ' a month' : ''}</li>
                  <li><Check size={13} /> {p.exports} video exports{p.interval === 'month' ? ' a month' : ''}</li>
                  <li><Check size={13} /> Recordings up to {p.maxSourceMinutes} minutes</li>
                  <li><Check size={13} /> Files kept {p.retentionDays} days</li>
                </ul>
                <button type="button" className={`btn ${p.id === 'trial' ? 'btn-secondary' : 'btn-primary'}`} onClick={onSignUp}>
                  {p.id === 'trial' ? 'Start free' : 'Start with the free trial'}
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="landing-section" aria-labelledby="contact-h">
          <div className="panel-card" style={{ textAlign: 'center', padding: 'clamp(1.5rem, 5vw, 3rem)' }}>
            <h2 id="contact-h" className="landing-h2" style={{ marginBottom: '0.6rem' }}>Want to see it on your own recording first?</h2>
            <p className="text-muted" style={{ fontSize: '0.9375rem', maxWidth: 560, margin: '0 auto 1.25rem', lineHeight: 1.6 }}>
              We’ll run one of your recordings with you on a call and show you the clips — and want to hear what’s wrong with them.
            </p>
            <a href={PHONE_LINK} className="btn btn-primary"><Phone size={15} /> Call Aman A K · {PHONE_DISPLAY}</a>
            <p className="text-subtle" style={{ fontSize: '0.8125rem', marginTop: '1rem', display: 'flex', gap: '0.4rem', justifyContent: 'center', alignItems: 'center' }}>
              <MapPin size={13} /> Mangaluru, Karnataka
            </p>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <span>© {new Date().getFullYear()} Viralis</span>
        <nav aria-label="Legal" className="footer-links">
          <a href="/terms">Terms</a>
          <a href="/privacy">Privacy</a>
          <a href="/refunds">Refunds &amp; cancellation</a>
          <a href="/content-policy">Content policy</a>
          <a href="/contact">Contact</a>
        </nav>
      </footer>
    </div>
  );
}
