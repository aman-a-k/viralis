"use client";

import React from 'react';
import { BrandMark } from './BrandMark';
import { Scissors, Captions, Send, LineChart, ClipboardCheck, ArrowRight, Phone, MapPin, Check } from 'lucide-react';

interface LandingPageProps {
  onSignIn: () => void;
}

const PHONE_DISPLAY = '93427 39999';
const PHONE_LINK = 'tel:+919342739999';

const STEPS = [
  { icon: Scissors, title: 'Finds the highlights', text: 'Reads the whole recording and picks the moments most likely to hold a viewer.' },
  { icon: Captions, title: 'Adds captions', text: 'Cuts each moment, reframes it to vertical 9:16, and burns in captions that follow the speech.' },
  { icon: Send, title: 'Publishes for you', text: 'Sends the finished clip to your YouTube channel. Nothing goes out until you approve it.' },
  { icon: LineChart, title: 'Learns what works', text: 'Tracks how each published clip performs, so you can see which kinds of moments hold your audience.' },
];

const PLANS = [
  { name: 'Free', price: 'Rs 0', hours: '30 minutes of source video', note: 'To try it on your own video' },
  { name: 'Creator', price: 'Rs 399', hours: '4 hours of source video', note: 'About Rs 100 an hour', featured: true },
  { name: 'Pro', price: 'Rs 999', hours: '12 hours of source video', note: 'About Rs 83 an hour' },
  { name: 'Institute', price: 'Rs 2,499', hours: '30 hours of source video', note: 'For colleges, coaching centres and groups with several channels' },
];

export function LandingPage({ onSignIn }: LandingPageProps) {
  return (
    <div className="landing">
      <a href="#landing-main" className="skip-link">Skip to content</a>

      <nav className="landing-nav">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <BrandMark size={30} />
          <span style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.03em', color: '#fff' }}>
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
              Made in Mangaluru · Go viral, on autopilot.
            </span>
            <h1>Your long videos are hiding your best clips.</h1>
            <p>
              Viralis turns one long video into ready-to-post vertical clips for YouTube Shorts,
              adds captions, publishes them for you, and learns what works.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              <a href={PHONE_LINK} className="btn btn-primary" style={{ padding: '0.7rem 1.5rem', fontSize: '0.9375rem' }}>
                <Phone size={15} /> Call {PHONE_DISPLAY}
              </a>
              <button type="button" onClick={onSignIn} className="btn btn-secondary" style={{ padding: '0.7rem 1.5rem', fontSize: '0.9375rem' }}>
                Sign in <ArrowRight size={15} />
              </button>
            </div>
            <p style={{ fontSize: '0.8125rem', marginTop: '1rem' }} className="text-subtle">
              First 14 days free. Access is by invitation while we onboard our first creators and institutes.
            </p>
          </div>
        </div>

        <section className="landing-section" aria-label="How it works">
          <div className="landing-features">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              return (
                <div className="landing-feature-card" key={s.title}>
                  <div className="landing-feature-icon" aria-hidden="true">
                    <Icon size={18} />
                  </div>
                  <span className="text-subtle" style={{ fontSize: '0.6875rem', fontWeight: 700 }}>0{i + 1}</span>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>{s.title}</h3>
                  <p className="text-muted" style={{ fontSize: '0.8125rem', lineHeight: 1.55 }}>{s.text}</p>
                </div>
              );
            })}
          </div>
          <p className="text-subtle" style={{ fontSize: '0.75rem', textAlign: 'center', marginTop: '0.9rem', display: 'flex', gap: '0.4rem', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
            <ClipboardCheck size={13} /> Every clip waits in an approval queue before it is published. Publishing is to YouTube today.
          </p>
        </section>

        <section className="landing-section" aria-label="Pricing">
          <h2 style={{ fontSize: 'clamp(1.25rem, 3vw, 1.75rem)', fontWeight: 800, textAlign: 'center', marginBottom: '0.4rem' }}>
            Priced in rupees, by the hour of video
          </h2>
          <p className="text-muted" style={{ fontSize: '0.875rem', textAlign: 'center', marginBottom: '1.5rem' }}>
            Prices are monthly and before 18% GST. Plans start after your 14 days free.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))', gap: '1rem' }}>
            {PLANS.map((p) => (
              <div
                key={p.name}
                className="panel-card"
                style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderColor: p.featured ? 'var(--accent-line)' : undefined }}
              >
                <span className="text-subtle" style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{p.name}</span>
                <p style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.03em' }}>
                  {p.price}<span className="text-subtle" style={{ fontSize: '0.8125rem', fontWeight: 500 }}> / month</span>
                </p>
                <p style={{ fontSize: '0.875rem', display: 'flex', gap: '0.4rem', alignItems: 'flex-start' }}>
                  <Check size={15} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} /> {p.hours}
                </p>
                <p className="text-muted" style={{ fontSize: '0.75rem' }}>{p.note}</p>
              </div>
            ))}
          </div>
          <p className="text-subtle" style={{ fontSize: '0.75rem', textAlign: 'center', marginTop: '0.9rem' }}>
            Online payment isn&apos;t switched on yet — pilot users are set up personally. Call to get started.
          </p>
        </section>

        <section className="landing-section" aria-label="Contact">
          <div className="panel-card" style={{ textAlign: 'center', padding: 'clamp(1.5rem, 5vw, 3rem)' }}>
            <h2 style={{ fontSize: 'clamp(1.25rem, 3vw, 1.75rem)', fontWeight: 800, marginBottom: '0.6rem' }}>
              Bring us a long video. See the clips.
            </h2>
            <p className="text-muted" style={{ fontSize: '0.9375rem', maxWidth: 560, margin: '0 auto 1.25rem', lineHeight: 1.6 }}>
              Meet in Mangaluru or over a call, watch a demo on your own recording, and tell us what is wrong with it.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <a href={PHONE_LINK} className="btn btn-primary"><Phone size={15} /> Call Aman A K · {PHONE_DISPLAY}</a>
            </div>
            <p className="text-subtle" style={{ fontSize: '0.8125rem', marginTop: '1rem', display: 'flex', gap: '0.4rem', justifyContent: 'center', alignItems: 'center' }}>
              <MapPin size={13} /> Mangaluru, Karnataka
            </p>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <span>© {new Date().getFullYear()} Viralis · Go viral, on autopilot.</span>
      </footer>
    </div>
  );
}
