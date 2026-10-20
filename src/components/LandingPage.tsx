"use client";

import React, { useEffect, useState } from 'react';
import { ArrowRight, Check, MapPin, Plus, ShieldCheck, Sparkles, Lock } from 'lucide-react';
import { BrandMark } from './BrandMark';
import { Reveal, CountUp } from './motion';
import { PLANS, formatInr } from '@/lib/plans';

interface LandingPageProps {
  onSignIn: () => void;
  onSignUp: () => void;
}

// A real before/after example recorded with permission. Shown only when set.
const DEMO_VIDEO = process.env.NEXT_PUBLIC_DEMO_VIDEO_URL;

const PLAN_LIST = Object.values(PLANS).filter((p) => p.available);

const STEPS = [
  { title: 'Upload a recording', text: 'A lesson, webinar, interview or talk you recorded — or a link to your own YouTube video.' },
  { title: 'Get the best moments', text: 'Viralis reads the whole recording and suggests 3–10 standalone clips, each with captions timed to the speech.' },
  { title: 'Fix anything', text: 'Trim the start and end, correct caption words, and choose the framing — crop to the speaker or show the whole slide.' },
  { title: 'Download or publish', text: 'Export vertical, square or wide videos, or publish straight to YouTube after you approve.' },
];

const AUDIENCE = ['Teachers', 'Coaching institutes', 'Webinar hosts', 'Podcasters', 'Colleges', 'Doctors & clinics', 'Founders', 'Trainers', 'Creators'];
const LANGS = ['English', 'हिन्दी', 'ಕನ್ನಡ', 'தமிழ்', 'తెలుగు', 'മലയാളം', 'मराठी', 'বাংলা'];

const FAQ: [string, string][] = [
  ['What kind of recordings work best?', 'Anything with someone talking: classes, webinars, interviews, podcasts, talks and explainers. Viralis looks for moments that make sense on their own — a clear point, a story, a strong answer — so continuous speech gives the best results.'],
  ['Which languages are supported?', 'Captions follow the speech word by word in English, Hindi, Kannada, Tamil, Telugu, Malayalam, Marathi, Bengali and more. You can correct any word in the editor before exporting.'],
  ['Will anything be posted without me?', 'No. Every clip goes through your review, and publishing to YouTube happens only when you click publish. You can also just download the videos and post them yourself.'],
  ['Who can see my recordings?', 'Only members of your workspace. Files are stored privately, shared through short-lived links, and deleted automatically after your plan’s retention period.'],
  ['Can Viralis promise my clips will go viral?', 'No — and be wary of anyone who does. Viralis saves you the hours of finding, cutting and captioning moments. What performs depends on your content and audience; the Performance tab shows you what’s actually working.'],
  ['How does billing work?', `Start with a free trial: ${PLANS.trial.sourceMinutes} minutes of recording and ${PLANS.trial.exports} exports, no card needed. Paid plans are billed monthly in rupees, plus applicable taxes, and you can cancel anytime.`],
];

// Deterministic waveform so server and client render the same bars.
const BARS = Array.from({ length: 72 }, (_, i) => 18 + Math.abs(Math.sin(i * 0.55) * 46 + Math.sin(i * 1.7) * 22 + Math.cos(i * 0.21) * 12));
const SEGMENTS = [
  { from: 0.1, to: 0.25, label: '92' },
  { from: 0.42, to: 0.57, label: '88' },
  { from: 0.7, to: 0.86, label: '95' },
];
const CLIP_CAPTIONS = [
  ['MOST PEOPLE', 'FAIL BECAUSE', 'FEEDBACK', 'IS TOO SLOW'],
  ['PRACTICE', 'THE HARD PART', 'NOT THE', 'FUN PART'],
  ['TEACH IT', 'TO SOMEONE', 'AND YOU’LL', 'GET IT'],
];
const TRANSCRIPT = [
  'Today I want to talk about why most people fail at learning a new skill.',
  'It’s not talent. It’s that they never get feedback fast enough.',
  'So, rule two: practice the hard part, not the fun part.',
  'Most players practise the songs they already know.',
  'And the one nobody talks about — teach it to someone else.',
];

const LOOP_MS = 9000;

function HeroDemo() {
  const [t, setT] = useState(0); // 0..1 through the loop
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const id = requestAnimationFrame(() => setT(0.95));
      return () => cancelAnimationFrame(id);
    }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      setT(((now - start) % LOOP_MS) / LOOP_MS);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const head = Math.min(1, t / 0.62); // playhead sweeps during the first 62%
  const found = SEGMENTS.filter((s) => head >= s.to).length;
  const stage = head < 0.08 ? 0 : head < 1 ? 1 : t < 0.75 ? 2 : 3;
  const word = Math.floor((t * LOOP_MS) / 420) % 4;
  const hl = Math.min(TRANSCRIPT.length - 1, Math.floor(head * TRANSCRIPT.length));

  return (
    <div className="demo" aria-hidden="true">
      <div className="demo-inner">
        <div className="demo-chrome"><i /><i /><i /><span>viralis · Week 3 — How to learn anything faster.mp4</span></div>
        <div className="demo-body">
          <div>
            <div className="demo-label"><span>Recording · 42:18</span><span style={{ color: 'var(--accent-hover)' }}>{found} of 3 moments found</span></div>
            <div className="wave">
              {BARS.map((h, i) => {
                const x = i / BARS.length;
                const inSeg = SEGMENTS.some((s) => x >= s.from && x <= s.to && head >= s.to);
                return <div key={i} className={`bar ${inSeg ? 'hit' : ''}`} style={{ height: `${Math.min(92, h)}%`, opacity: x <= head ? 1 : 0.45 }} />;
              })}
              {SEGMENTS.map((s, i) => (
                <div key={i} className={`seg ${head >= s.to ? 'on' : ''}`} style={{ left: `${s.from * 100}%`, width: `${(s.to - s.from) * 100}%` }}>
                  <em>{s.label}</em>
                </div>
              ))}
              <div className="head" style={{ left: `${head * 100}%`, opacity: head < 1 ? 1 : 0 }} />
            </div>
            <p className="demo-transcript">
              {TRANSCRIPT.map((line, i) => (
                <span key={i} className={i === hl || (i === 4 && found === 3) || (i === 0 && found >= 1) || (i === 2 && found >= 2) ? 'hl' : ''}>{line} </span>
              ))}
            </p>
            <div className="demo-steps">
              {['Transcribe', 'Find moments', 'Caption', 'Ready to review'].map((s, i) => (
                <span key={s} className={i < stage ? 'done' : i === stage ? 'on' : ''}>{i < stage ? '✓ ' : ''}{s}</span>
              ))}
            </div>
          </div>
          <div>
            <div className="demo-label"><span>Clips · 9:16</span><span>Captions on</span></div>
            <div className="phones">
              {CLIP_CAPTIONS.map((cap, i) => (
                <div key={i} className={`phone ${found > i ? 'on' : ''}`} style={{ transitionDelay: `${i * 90}ms` }}>
                  <div className="ph-head" /><div className="ph-person" />
                  <span className="ph-score">{SEGMENTS[i].label}</span>
                  <span className="ph-time">0:{[38, 44, 31][i]}</span>
                  <div className="ph-cap">
                    {cap.map((w, j) => (j === word ? <b key={j}>{w} </b> : j === (word + 1) % 4 ? <span key={j}>{w} </span> : null))}
                  </div>
                  <div className="ph-bar" style={{ animationDelay: `${i * -0.8}s` }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Karaoke() {
  const words = ['Captions', 'that', 'follow', 'every', 'single', 'word'];
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((v) => (v + 1) % (words.length + 2)), 380);
    return () => clearInterval(id);
  }, [words.length]);
  return <div className="karaoke">{words.map((w, j) => <span key={w} className={j === i ? 'on' : ''}>{w}</span>)}</div>;
}

function Aspects() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((v) => (v + 1) % 3), 1400);
    return () => clearInterval(id);
  }, []);
  const shapes: [string, number, number][] = [['9:16', 54, 96], ['1:1', 84, 84], ['16:9', 128, 72]];
  return (
    <div className="aspects">
      {shapes.map(([l, w, h], j) => <div key={l} className={i === j ? 'on' : ''} style={{ width: w, height: h }}>{l}</div>)}
    </div>
  );
}

function ApproveDemo() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setN((v) => (v + 1) % 5), 1100);
    return () => clearInterval(id);
  }, []);
  const rows = ['The 3-second rule for hooks', 'Why feedback beats talent', 'A student’s 30-day story'];
  return (
    <div className="approve-list">
      {rows.map((r, j) => (
        <div key={r} className="approve-row">
          <Sparkles size={13} color="var(--accent)" /> {r}
          <span className={`st ${n > j ? 'ok' : 'wait'}`}>{n > j ? 'Approved' : 'In review'}</span>
        </div>
      ))}
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`faq-item ${open ? 'open' : ''}`}>
      <button type="button" className="faq-q" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {q} <Plus size={18} />
      </button>
      <div className="faq-a" role="region"><div><p>{a}</p></div></div>
    </div>
  );
}

function Steps() {
  const [ref, setRef] = useState<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!ref) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); io.disconnect(); } }, { threshold: 0.3 });
    io.observe(ref);
    return () => io.disconnect();
  }, [ref]);
  return (
    <div ref={setRef} className={`steps ${inView ? 'in' : ''}`}>
      <div className="line-fill" />
      {STEPS.map((s, i) => (
        <Reveal className="step" key={s.title} delay={i * 120}>
          <div className="step-num">0{i + 1}</div>
          <h3>{s.title}</h3>
          <p>{s.text}</p>
        </Reveal>
      ))}
    </div>
  );
}

export function LandingPage({ onSignIn, onSignUp }: LandingPageProps) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);

  const title = ['Turn', 'one', 'recording', 'into', 'a', 'week', 'of'];

  return (
    <div className="lp">
      <a href="#landing-main" className="skip-link">Skip to content</a>

      <nav className={`lp-nav ${scrolled ? 'scrolled' : ''}`} aria-label="Site">
        <a href="#top" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <BrandMark size={30} />
          <span style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.03em' }}>Viralis</span>
        </a>
        <div className="lp-links">
          <a href="#how">How it works</a>
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <a href="#faq">FAQ</a>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" onClick={onSignIn} className="btn btn-ghost">Sign in</button>
          <button type="button" onClick={onSignUp} className="btn btn-primary">Start free <ArrowRight size={14} /></button>
        </div>
      </nav>

      <main id="landing-main">
        <section className="lp-hero" id="top">
          <div className="lp-grid-bg" />
          <div className="lp-aurora" />
          <span className="lp-pill" style={{ animation: 'view-in 0.7s var(--ease-out) both' }}>
            <b>NEW</b> <span className="live-dot" /> Captions in 8+ Indian languages
          </span>
          <h1 className="lp-title">
            {title.map((w, i) => <span key={i} className="w" style={{ animationDelay: `${0.08 + i * 0.06}s` }}>{w}&nbsp;</span>)}
            <span className="w accent" style={{ animationDelay: `${0.08 + title.length * 0.06}s` }}>
              clips.
              <svg viewBox="0 0 200 20" preserveAspectRatio="none"><path d="M3 15 Q 60 3 110 10 T 197 7" /></svg>
            </span>
          </h1>
          <p className="lp-sub">
            Upload a lesson, webinar or talk. Viralis finds the strongest standalone moments, cuts them to vertical and burns in
            captions that follow every word. You review, tweak and post.
          </p>
          <div className="lp-ctas">
            <button type="button" onClick={onSignUp} className="btn btn-primary btn-xl">Start free — no card <ArrowRight size={16} /></button>
            <a href="#how" className="btn btn-secondary btn-xl">See how it works</a>
          </div>
          <p className="lp-note">Free trial: {PLANS.trial.sourceMinutes} minutes of recording and {PLANS.trial.exports} video exports.</p>
          <HeroDemo />
        </section>

        <div className="marquee" aria-label="Who uses Viralis" style={{ marginTop: 'clamp(3rem, 7vw, 5rem)' }}>
          <div className="marquee-track">
            {[...AUDIENCE, ...LANGS, ...AUDIENCE, ...LANGS].map((w, i) => <span key={i}>{w}</span>)}
          </div>
        </div>

        {DEMO_VIDEO && (
          <section className="lp-section" aria-label="Example">
            <Reveal className="lp-head-center"><span className="lp-eyebrow">Real example</span><h2 className="lp-h2">Before and after</h2></Reveal>
            <Reveal delay={100}>
              <video src={DEMO_VIDEO} controls preload="metadata" style={{ width: '100%', maxWidth: 880, display: 'block', margin: '2rem auto 0', borderRadius: 18, background: '#000', border: '1px solid var(--border-2)' }} />
            </Reveal>
          </section>
        )}

        <section className="lp-section" id="how" aria-labelledby="how-h">
          <Reveal>
            <span className="lp-eyebrow"><Sparkles size={13} /> How it works</span>
            <h2 id="how-h" className="lp-h2">From a 45-minute class to ready-to-post clips in minutes.</h2>
            <p className="lp-lead">No timeline scrubbing, no subtitle typing. You stay in control of every cut and every word.</p>
          </Reveal>
          <Steps />
        </section>

        <section className="lp-section" id="features" aria-labelledby="feat-h">
          <Reveal className="lp-head-center">
            <span className="lp-eyebrow">Features</span>
            <h2 id="feat-h" className="lp-h2">Everything between “recorded” and “posted”.</h2>
          </Reveal>
          <div className="bento">
            <Reveal className="bento-card tall spot">
              <h3>Word-perfect captions, in your language</h3>
              <p>Captions are timed to each spoken word and burned into the video — bold three-word pops or clean lines. Fix any word before you export.</p>
              <div className="bento-visual">
                <Karaoke />
                <div className="langs">{LANGS.map((l) => <span key={l}>{l}</span>)}<span>+ more</span></div>
              </div>
            </Reveal>
            <Reveal className="bento-card spot" delay={80}>
              <h3>Reframed for every feed</h3>
              <p>Vertical, square or wide. Crop to the speaker or fit the whole slide.</p>
              <div className="bento-visual"><Aspects /></div>
            </Reveal>
            <Reveal className="bento-card wide spot">
              <h3>Nothing posts without you</h3>
              <p>Clips land in a review queue. Approve, reject with a note, or edit first — your team sees the same queue.</p>
              <div className="bento-visual"><ApproveDemo /></div>
            </Reveal>
            <Reveal className="bento-card wide spot" delay={80}>
              <h3>Publish to YouTube in one click</h3>
              <p>Connect your channel once. Approved clips upload with their title, description and visibility you choose.</p>
              <div className="bento-visual">
                <div className="yt-visual"><div className="yt" /><div style={{ flex: 1 }}><p style={{ fontSize: '0.78rem', color: 'var(--text)', fontWeight: 650, marginBottom: 6 }}>Why feedback beats talent</p><div className="prog"><i /></div></div><Check size={16} color="var(--green)" /></div>
              </div>
            </Reveal>
            <Reveal className="bento-card wide spot">
              <h3>Learns what works for you</h3>
              <p>Real watch-through and views from YouTube feed back into which moments Viralis suggests next.</p>
              <div className="bento-visual">
                <div className="bars">
                  {[38, 62, 45, 88, 54, 71, 96].map((h, i) => <div key={i} className={h > 85 ? 'top' : ''} style={{ ['--h' as string]: `${h}%`, transitionDelay: `${i * 70}ms` }} />)}
                </div>
              </div>
            </Reveal>
            <Reveal className="bento-card wide spot" delay={80}>
              <h3>Private by default</h3>
              <p>Recordings stay inside your workspace, are served through short-lived links, and are deleted after your retention period.</p>
              <div className="bento-visual"><div className="lock-visual"><div className="ring"><Lock size={26} /></div></div></div>
            </Reveal>
          </div>

          <Reveal className="facts">
            <div className="fact"><strong><CountUp value={10} /><em>×</em></strong><span>up to 10 clips per recording</span></div>
            <div className="fact"><strong><CountUp value={90} /><em>m</em></strong><span>recordings up to 90 minutes</span></div>
            <div className="fact"><strong><CountUp value={8} /><em>+</em></strong><span>Indian languages captioned</span></div>
            <div className="fact"><strong>0</strong><span>posts without your approval</span></div>
          </Reveal>
        </section>

        <section className="lp-section" id="pricing" aria-labelledby="pricing-h">
          <Reveal className="lp-head-center">
            <span className="lp-eyebrow">Pricing</span>
            <h2 id="pricing-h" className="lp-h2">Simple, in rupees.</h2>
            <p className="lp-lead">Billed monthly, plus applicable taxes. Cancel anytime. Try it free first.</p>
          </Reveal>
          <div className="price-grid">
            {PLAN_LIST.map((p, i) => (
              <Reveal key={p.id} delay={i * 90} className={`price-card spot ${p.id === 'creator' ? 'featured' : ''}`}>
                {p.id === 'creator' && <span className="tag">Most popular</span>}
                <span className="eyebrow">{p.name}</span>
                <p className="amount">{p.pricePaise ? formatInr(p.pricePaise) : '₹0'}<small>{p.interval === 'month' ? ' / month' : ' · one-time'}</small></p>
                <p className="text-muted" style={{ fontSize: '0.86rem' }}>{p.blurb}</p>
                <ul>
                  <li><Check size={14} /> {p.sourceMinutes} minutes of recordings{p.interval === 'month' ? ' a month' : ''}</li>
                  <li><Check size={14} /> {p.exports} video exports{p.interval === 'month' ? ' a month' : ''}</li>
                  <li><Check size={14} /> Recordings up to {p.maxSourceMinutes} minutes</li>
                  <li><Check size={14} /> Files kept {p.retentionDays} days</li>
                </ul>
                <button type="button" className={`btn btn-lg ${p.id === 'creator' ? 'btn-primary' : 'btn-secondary'}`} onClick={onSignUp}>
                  {p.id === 'trial' ? 'Start free' : 'Start with the free trial'}
                </button>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="lp-section" id="faq" aria-labelledby="faq-h">
          <Reveal className="lp-head-center">
            <span className="lp-eyebrow">FAQ</span>
            <h2 id="faq-h" className="lp-h2">Questions, answered.</h2>
          </Reveal>
          <Reveal className="faq">{FAQ.map(([q, a]) => <FaqItem key={q} q={q} a={a} />)}</Reveal>
        </section>

        <section className="lp-section" aria-labelledby="cta-h">
          <Reveal className="cta-band">
            <span className="lp-eyebrow"><ShieldCheck size={13} /> Free trial · no card</span>
            <h2 id="cta-h" className="lp-h2">See it on your own recording.</h2>
            <p className="lp-lead">Register, upload one of your classes or talks, and get your clips in minutes.</p>
            <div className="lp-ctas" style={{ animation: 'none' }}>
              <button type="button" onClick={onSignUp} className="btn btn-primary btn-xl">Register now <ArrowRight size={16} /></button>
              <button type="button" onClick={onSignIn} className="btn btn-secondary btn-xl">Sign in</button>
            </div>
            <p className="text-subtle" style={{ fontSize: '0.82rem', marginTop: '1.25rem', display: 'flex', gap: '0.4rem', justifyContent: 'center', alignItems: 'center' }}>
              <MapPin size={13} /> Made in Mangaluru, Karnataka
            </p>
          </Reveal>
        </section>
      </main>

      <footer className="lp-footer">
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><BrandMark size={20} /> © {new Date().getFullYear()} Viralis</span>
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
