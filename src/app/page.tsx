"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Home, Scissors, Inbox, Radar, BarChart3, CreditCard, Settings, Shield, LogOut, Menu, X, Upload, ArrowRight, Mail,
  Search, Link2, FileText, Keyboard, Check, Film, Lightbulb, FolderOpen, Sparkles,
} from 'lucide-react';
import type { DashboardData } from '@/types';
import { api, ApiError, errorMessage } from '@/lib/client';
import { StudioView, type StudioMode } from '@/components/StudioView';
import { ReviewView } from '@/components/ReviewView';
import { TrendHistoryView } from '@/components/TrendHistoryView';
import { FeedbackLoopView } from '@/components/FeedbackLoopView';
import { BillingView } from '@/components/BillingView';
import { SettingsView } from '@/components/SettingsView';
import { AdminView } from '@/components/AdminView';
import { LandingPage } from '@/components/LandingPage';
import { SectionErrorBoundary } from '@/components/SectionErrorBoundary';
import { BrandMark } from '@/components/BrandMark';
import { CommandPalette, type Command } from '@/components/CommandPalette';
import { CountUp } from '@/components/motion';

type Tab = 'home' | 'projects' | 'review' | 'trends' | 'performance' | 'billing' | 'settings' | 'admin';
const TABS: Tab[] = ['home', 'projects', 'review', 'trends', 'performance', 'billing', 'settings', 'admin'];

const TITLES: Record<Tab, [string, string]> = {
  home: ['Home', 'Where things stand and what to do next.'],
  projects: ['Projects', 'Turn a recording into editable, captioned clips.'],
  review: ['Review', 'Approve clips before they’re published.'],
  trends: ['Trends', 'Today’s real search trends, scored for your niche.'],
  performance: ['Performance', 'How your published clips are doing.'],
  billing: ['Billing', 'Your plan, usage and payments.'],
  settings: ['Settings', 'Brand, channel, members and account.'],
  admin: ['Admin', 'Platform health across all workspaces.'],
};

// "g" then a letter jumps to a page, like Linear/GitHub.
const GOTO: Record<string, Tab> = { h: 'home', p: 'projects', r: 'review', t: 'trends', a: 'performance', b: 'billing', s: 'settings' };

const OAUTH_MESSAGES: Record<string, string> = {
  youtube_state: 'The YouTube connection expired or was started elsewhere. Try again.',
  youtube_denied: 'YouTube access wasn’t granted.',
  youtube_no_refresh: 'Google didn’t grant lasting access. Remove Viralis at myaccount.google.com/permissions and connect again.',
  youtube_scope: 'Please allow uploading to YouTube when connecting.',
  youtube_failed: 'Connecting YouTube failed. Try again.',
  youtube_permission: 'Only workspace admins can connect a channel.',
  youtube_unavailable: 'Publishing to YouTube isn’t available yet.',
};

const isTyping = (el: EventTarget | null) => {
  const t = el as HTMLElement | null;
  return !!t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));
};

function BootSkeleton({ message }: { message: string }) {
  return (
    <div className="boot-shell" role="status" aria-label={message}>
      <div className="boot-side">
        <div className="skeleton" style={{ height: 26, width: 110, marginBottom: 18 }} />
        {Array.from({ length: 7 }, (_, i) => <div key={i} className="skeleton" style={{ height: 22, width: `${60 + ((i * 37) % 35)}%` }} />)}
      </div>
      <div className="boot-main">
        <div className="skeleton" style={{ height: 28, width: 180 }} />
        <div className="skeleton" style={{ height: 14, width: 280 }} />
        <div className="skeleton" style={{ height: 120, marginTop: 10, borderRadius: 18 }} />
        <div className="grid-metrics">{Array.from({ length: 4 }, (_, i) => <div key={i} className="skeleton" style={{ height: 96, borderRadius: 13 }} />)}</div>
        <p className="sr-only">{message}</p>
      </div>
    </div>
  );
}

export default function App() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [tab, setTabState] = useState<Tab>(() => {
    if (typeof window === 'undefined') return 'home';
    const q = new URLSearchParams(window.location.search);
    const t = q.get('tab') as Tab | null;
    if (q.get('checkout') === 'plans') return 'billing';
    return t && TABS.includes(t) ? t : 'home';
  });
  const [data, setData] = useState<DashboardData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  // Remounts Projects with a starting mode/project when chosen from the palette or Home.
  const [studioIntent, setStudioIntent] = useState<{ n: number; mode?: StudioMode; projectId?: string }>({ n: 0 });

  const fetchData = useCallback(async () => {
    try {
      const res = await api<{ data: DashboardData }>('/api/data');
      setData(res.data);
      setLoadError(null);
    } catch (err) {
      // The session outlived its account (deleted, or a reset database):
      // start over at sign-in instead of stranding the user on an error.
      if (err instanceof ApiError && err.status === 401) {
        signOut({ callbackUrl: '/auth/signin' });
        return;
      }
      setLoadError(errorMessage(err));
    }
  }, []);

  const setTab = useCallback((t: Tab) => {
    setTabState(t);
    setNavOpen(false);
    const url = new URL(window.location.href);
    url.search = t === 'home' ? '' : `?tab=${t}`;
    window.history.replaceState(null, '', url);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const openStudio = useCallback((intent: { mode?: StudioMode; projectId?: string }) => {
    setStudioIntent((prev) => ({ n: prev.n + 1, ...intent }));
    setTab('projects');
  }, [setTab]);

  // One-time messages carried in the URL (OAuth/verification redirects).
  useEffect(() => {
    if (authStatus !== 'authenticated') return;
    const q = new URLSearchParams(window.location.search);
    const t = q.get('tab') as Tab | null;
    if (q.get('success') === 'youtube_connected') toast.success('YouTube connected.');
    const err = q.get('error');
    if (err && OAUTH_MESSAGES[err]) toast.error(OAUTH_MESSAGES[err], { duration: 9000 });
    if (q.get('verify') === 'ok') toast.success('Email confirmed — you’re all set.');
    if (q.get('verify') === 'invalid') toast.error('That confirmation link is invalid or expired. Resend it from Settings.');
    if (q.toString()) window.history.replaceState(null, '', t && TABS.includes(t) ? `/?tab=${t}` : '/');
  }, [authStatus]);

  useEffect(() => {
    if (authStatus !== 'authenticated') return;
    const timer = setInterval(fetchData, 30_000);
    const first = setTimeout(fetchData, 0);
    const onFocus = () => fetchData();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(timer);
      clearTimeout(first);
      window.removeEventListener('focus', onFocus);
    };
  }, [authStatus, fetchData]);

  // Keyboard: ⌘K / Ctrl+K palette, "?" shortcuts, "g" + letter navigation.
  const pendingG = useRef<number>(0);
  useEffect(() => {
    if (authStatus !== 'authenticated') return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target) || document.querySelector('.modal-backdrop, .cmdk-backdrop')) return;
      if (e.key === '?') { e.preventDefault(); setShortcutsOpen((v) => !v); return; }
      if (e.key === 'Escape') { setShortcutsOpen(false); return; }
      if (e.key === 'g') { pendingG.current = Date.now(); return; }
      if (Date.now() - pendingG.current < 1200 && GOTO[e.key]) {
        pendingG.current = 0;
        setTab(GOTO[e.key]);
      }
      if (e.key === 'c' && Date.now() - pendingG.current > 1200) openStudio({ mode: 'upload' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [authStatus, setTab, openStudio]);

  const commands = useMemo<Command[]>(() => {
    if (!data) return [];
    const nav: [Tab, string, React.ElementType, string][] = [
      ['home', 'Home', Home, 'G H'], ['projects', 'Projects', Scissors, 'G P'], ['review', 'Review queue', Inbox, 'G R'],
      ['trends', 'Trends', Radar, 'G T'], ['performance', 'Performance', BarChart3, 'G A'], ['billing', 'Billing & plan', CreditCard, 'G B'],
      ['settings', 'Settings', Settings, 'G S'],
    ];
    if (data.user.isPlatformAdmin) nav.push(['admin', 'Admin', Shield, '']);
    return [
      { id: 'new-upload', group: 'Create', label: 'Upload a recording', icon: Upload, hint: 'C', keywords: 'new project video file', run: () => openStudio({ mode: 'upload' }) },
      { id: 'new-link', group: 'Create', label: 'Find clips in a YouTube link', icon: Link2, keywords: 'new project url', run: () => openStudio({ mode: 'link' }) },
      { id: 'new-transcript', group: 'Create', label: 'Paste a transcript', icon: FileText, keywords: 'new project text', run: () => openStudio({ mode: 'transcript' }) },
      { id: 'new-browse', group: 'Create', label: 'Browse trending videos', icon: Radar, keywords: 'inspiration youtube', run: () => openStudio({ mode: 'browse' }) },
      ...nav.map(([t, label, icon, hint]) => ({ id: `go-${t}`, group: 'Go to', label, icon, hint, keywords: 'navigate page', run: () => setTab(t) })),
      ...data.projects.slice(0, 30).map((p) => ({
        id: `p-${p.id}`, group: 'Projects', label: p.title, icon: FolderOpen,
        hint: p.status === 'ready' ? `${p.clips.filter((c) => c.status !== 'rejected').length} clips` : p.status,
        keywords: 'open recording', run: () => openStudio({ projectId: p.id }),
      })),
      { id: 'shortcuts', group: 'Help', label: 'Keyboard shortcuts', icon: Keyboard, hint: '?', run: () => setShortcutsOpen(true) },
      { id: 'signout', group: 'Account', label: 'Sign out', icon: LogOut, run: () => signOut({ callbackUrl: '/' }) },
    ];
  }, [data, openStudio, setTab]);

  if (authStatus === 'loading') return <BootSkeleton message="Loading…" />;

  if (authStatus !== 'authenticated') {
    return <LandingPage onSignIn={() => router.push('/auth/signin')} onSignUp={() => router.push('/auth/signin?mode=signup')} />;
  }

  if (!data) {
    if (!loadError) return <BootSkeleton message="Opening your workspace…" />;
    return (
      <div className="center-screen" role="alert">
        <BrandMark size={36} />
        <p style={{ fontSize: '0.95rem', fontWeight: 600 }}>{loadError}</p>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" className="btn btn-primary" onClick={fetchData}>Try again</button>
          <button type="button" className="btn btn-ghost" onClick={() => signOut({ callbackUrl: '/' })}>Sign out</button>
        </div>
      </div>
    );
  }

  const pendingReview = data.approvalQueue.filter((i) => i.clipId).length;
  const nav: { group: string; items: [Tab, string, React.ElementType, number?][] }[] = [
    { group: 'Create', items: [['home', 'Home', Home], ['projects', 'Projects', Scissors], ['review', 'Review', Inbox, pendingReview]] },
    { group: 'Insights', items: [['trends', 'Trends', Radar], ['performance', 'Performance', BarChart3]] },
    { group: 'Account', items: [['billing', 'Billing', CreditCard], ['settings', 'Settings', Settings], ...(data.user.isPlatformAdmin ? [['admin', 'Admin', Shield] as [Tab, string, React.ElementType]] : [])] },
  ];
  const shortcutOf = (t: Tab) => Object.entries(GOTO).find(([, v]) => v === t)?.[0]?.toUpperCase();
  const [title, subtitle] = TITLES[tab];
  const metered = data.plan.source !== 'unlimited';
  const usedPct = data.plan.limits.sourceMinutes ? Math.min(1, data.plan.used.sourceMinutes / data.plan.limits.sourceMinutes) : 1;
  const minutesLeft = Math.max(0, data.plan.limits.sourceMinutes - data.plan.used.sourceMinutes);

  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">Skip to content</a>
      <header className="top-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
          <button type="button" className="icon-btn mobile-nav-toggle" onClick={() => setNavOpen((v) => !v)} aria-label={navOpen ? 'Close menu' : 'Open menu'} aria-expanded={navOpen}>
            {navOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
          <button type="button" onClick={() => setTab('home')} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', background: 'none', border: 0, color: 'inherit', cursor: 'pointer', padding: 0 }} aria-label="Viralis home">
            <BrandMark size={24} />
            <span style={{ fontSize: '0.9375rem', fontWeight: 700, letterSpacing: '-0.02em' }}>Viralis</span>
          </button>
          <span className="text-subtle truncate" style={{ fontSize: '0.78rem', maxWidth: 200 }}>/ {data.workspace.name}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button type="button" className="cmdk-trigger" onClick={() => setPaletteOpen(true)} aria-label="Open command menu">
            <Search size={14} /> <span className="cmdk-label">Search or jump to…</span> <kbd>⌘K</kbd>
          </button>
          {metered && (
            <button type="button" className="btn btn-ghost btn-sm usage-pill usage-ring" onClick={() => setTab('billing')} title={`${data.plan.used.sourceMinutes} of ${data.plan.limits.sourceMinutes} processing minutes used`}>
              {data.plan.source === 'none' ? 'Choose a plan' : (
                <>
                  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                    <circle cx="8" cy="8" r="6" fill="none" stroke="var(--surface-3)" strokeWidth="2.5" />
                    <circle cx="8" cy="8" r="6" fill="none" stroke={usedPct > 0.85 ? 'var(--amber)' : 'var(--accent)'} strokeWidth="2.5" strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 6} strokeDashoffset={2 * Math.PI * 6 * usedPct} />
                  </svg>
                  <span className="tnum">{minutesLeft} min left</span>
                </>
              )}
            </button>
          )}
        </div>
      </header>

      <div className="app-container">
        <div className={`sidebar-overlay ${navOpen ? 'open' : ''}`} onClick={() => setNavOpen(false)} aria-hidden="true" />
        <aside className={`sidebar-nav ${navOpen ? 'open' : ''}`} aria-label="Primary">
          <button type="button" className="btn btn-primary" style={{ width: '100%', marginBottom: '-0.25rem' }} onClick={() => openStudio({ mode: 'upload' })}>
            <Upload size={14} /> New project
          </button>
          {nav.map(({ group, items }) => (
            <div className="sidebar-group" key={group}>
              <p className="sidebar-section-title">{group}</p>
              {items.map(([id, label, Icon, count]) => (
                <button key={id} type="button" className={`nav-link ${tab === id ? 'active' : ''}`} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}>
                  <Icon /> {label}
                  {count ? <span className="badge badge-warning" style={{ marginLeft: 'auto' }}>{count}</span> : shortcutOf(id) && <span className="nav-kbd">G {shortcutOf(id)}</span>}
                </button>
              ))}
            </div>
          ))}
          <div className="sidebar-footer">
            <div className="sidebar-user">
              <div className="avatar" aria-hidden="true">{(session?.user?.name || data.user.email || 'U')[0].toUpperCase()}</div>
              <div className="sidebar-user-meta">
                <p style={{ fontSize: '0.78rem', fontWeight: 600 }} className="truncate">{session?.user?.name || data.user.email}</p>
                <p className="text-subtle truncate" style={{ fontSize: '0.7rem', textTransform: 'capitalize' }}>{data.user.role} · {data.plan.name}</p>
              </div>
              <button type="button" className="icon-btn" onClick={() => signOut({ callbackUrl: '/' })} aria-label="Sign out" title="Sign out"><LogOut size={14} /></button>
            </div>
          </div>
        </aside>

        <main className="main-viewport" id="main">
          {!data.user.emailVerified && (
            <div className="notice notice-warning" style={{ marginBottom: '1rem' }}>
              <Mail size={15} />
              <span>Confirm your email ({data.user.email}) to start processing recordings. <button type="button" className="link-button" onClick={() => setTab('settings')}>Resend the link</button></span>
            </div>
          )}

          <div key={tab} className="view-enter">
            {tab !== 'home' && (
              <div style={{ marginBottom: '1.25rem' }}>
                <h1 className="page-title">{title}</h1>
                <p className="text-muted" style={{ fontSize: '0.85rem' }}>{subtitle}</p>
              </div>
            )}

            <SectionErrorBoundary section={title}>
              {tab === 'home' && <HomeView data={data} name={session?.user?.name} go={setTab} openStudio={openStudio} />}
              {tab === 'projects' && (
                <StudioView key={studioIntent.n} initialMode={studioIntent.mode} initialProjectId={studioIntent.projectId}
                  data={data} onRefresh={fetchData} onGoToSettings={() => setTab('settings')} onGoToBilling={() => setTab('billing')} />
              )}
              {tab === 'review' && <ReviewView data={data} onRefresh={fetchData} />}
              {tab === 'trends' && <TrendHistoryView trends={data.trends} onRefreshed={fetchData} />}
              {tab === 'performance' && <FeedbackLoopView />}
              {tab === 'billing' && <BillingView onChanged={fetchData} />}
              {tab === 'settings' && <SettingsView data={data} onRefresh={fetchData} />}
              {tab === 'admin' && data.user.isPlatformAdmin && <AdminView />}
            </SectionErrorBoundary>
          </div>
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} commands={commands} />

      {shortcutsOpen && (
        <div className="cmdk-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setShortcutsOpen(false)}>
          <div className="cmdk" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" style={{ maxWidth: 420, padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 className="section-title">Keyboard shortcuts</h2>
              <button type="button" className="icon-btn" onClick={() => setShortcutsOpen(false)} aria-label="Close"><X size={15} /></button>
            </div>
            <ul className="shortcut-list">
              {[
                ['Command menu', ['⌘', 'K']], ['New project', ['C']], ['Home', ['G', 'H']], ['Projects', ['G', 'P']], ['Review', ['G', 'R']],
                ['Trends', ['G', 'T']], ['Performance', ['G', 'A']], ['Billing', ['G', 'B']], ['Settings', ['G', 'S']],
                ['In Review: next / previous', ['J', 'K']], ['In Review: approve / reject', ['A', 'X']], ['This sheet', ['?']],
              ].map(([label, keys]) => (
                <li key={label as string}><span>{label as string}</span><span>{(keys as string[]).map((k) => <kbd key={k} className="kbd">{k}</kbd>)}</span></li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Working late' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function HomeView({ data, name, go, openStudio }: {
  data: DashboardData;
  name?: string | null;
  go: (t: Tab) => void;
  openStudio: (i: { mode?: StudioMode; projectId?: string }) => void;
}) {
  const s = data.stats;
  const processing = data.projects.filter((p) => ['queued', 'transcribing', 'analyzing'].includes(p.status));
  const reviewCount = data.approvalQueue.filter((i) => i.clipId).length;
  const allClips = data.projects.flatMap((p) => p.clips);
  const firstName = (name || '').split(' ')[0];

  // One clear next step.
  const next =
    s.projects === 0
      ? { label: 'Upload your first recording', text: 'A lesson, webinar or talk you recorded. We’ll find the clips.', act: () => openStudio({ mode: 'upload' }), icon: Upload }
      : reviewCount > 0
        ? { label: `Review ${reviewCount} clip${reviewCount === 1 ? '' : 's'}`, text: 'Approve what’s ready, reject what isn’t.', act: () => go('review'), icon: Inbox }
        : processing.length > 0
          ? { label: 'See progress', text: `${processing.length} recording${processing.length === 1 ? ' is' : 's are'} being processed.`, act: () => openStudio({ projectId: processing[0].id }), icon: ArrowRight }
          : { label: 'Add another recording', text: 'Keep the clips coming — one recording a week is a great rhythm.', act: () => openStudio({ mode: 'upload' }), icon: Upload };

  const steps = [
    { label: 'Add your first recording', done: s.projects > 0, act: () => openStudio({ mode: 'upload' }) },
    { label: 'Get clip suggestions', done: s.clipsFound > 0, act: () => openStudio({}) },
    { label: 'Send a clip to review', done: allClips.some((c) => c.status !== 'candidate') || reviewCount > 0, act: () => openStudio({}) },
    { label: 'Export a captioned video', done: s.clipsExported > 0, act: () => openStudio({}) },
    { label: 'Publish to YouTube (optional)', done: s.clipsPublished > 0, act: () => go(data.channel.connected ? 'review' : 'settings') },
  ];
  const doneCount = steps.filter((x) => x.done).length;
  const nextIdx = steps.findIndex((x) => !x.done);
  const NextIcon = next.icon;

  const metrics: [string, number | null, string, string?][] = [
    ['Recordings', s.projects, 'added to this workspace'],
    ['Clips found', s.clipsFound, 'suggested moments'],
    ['Exported', s.clipsExported, 'clips with a video file'],
    ['Published', s.clipsPublished, 'live on YouTube'],
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <section className="home-hero">
        <div className="orbit" aria-hidden="true" />
        <div style={{ position: 'relative', minWidth: 0 }}>
          <p className="text-subtle" style={{ fontSize: '0.8rem', marginBottom: '0.3rem' }}>{greeting()}{firstName ? `, ${firstName}` : ''} 👋</p>
          <h1 className="sr-only">Home</h1>
          <h2>{next.label}</h2>
          <p className="text-muted" style={{ fontSize: '0.88rem', marginTop: '0.25rem' }}>{next.text}</p>
        </div>
        <button type="button" className="btn btn-primary btn-lg" onClick={next.act} style={{ position: 'relative' }}>
          <NextIcon size={15} /> {next.label}
        </button>
      </section>

      <div className="grid-metrics stagger">
        {metrics.map(([label, value, foot]) => (
          <div key={label} className="stat-card spot">
            <span className="stat-label">{label}</span>
            <span className="stat-value tnum">{value === null ? '—' : <CountUp value={value} />}</span>
            <span className="stat-foot">{foot}</span>
          </div>
        ))}
      </div>

      <div className="home-grid">
        <section className="panel-card settings-section" aria-labelledby="recent-h">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 id="recent-h" className="section-title">Recent recordings</h2>
            {data.projects.length > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={() => openStudio({})}>View all <ArrowRight size={12} /></button>}
          </div>
          {data.projects.length === 0 ? (
            <div className="empty-state" style={{ padding: '1.5rem 0.5rem' }}>
              <Film size={22} />
              <p className="text-muted" style={{ fontSize: '0.82rem', maxWidth: 360 }}>Nothing here yet. Your recordings and their clips will show up here.</p>
            </div>
          ) : (
            <ul className="member-list stagger">
              {data.projects.slice(0, 6).map((p) => (
                <li key={p.id}>
                  <span className="truncate" style={{ fontWeight: 550 }}>{p.title}</span>
                  <span className={`badge ${p.status === 'ready' ? 'badge-success' : p.status === 'failed' ? 'badge-danger' : 'badge-warning'}`}>
                    {p.status === 'ready' ? `${p.clips.filter((c) => c.status !== 'rejected').length} clips` : p.status === 'failed' ? 'Failed' : p.stage || 'Processing'}
                  </span>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => openStudio({ projectId: p.id })}>Open</button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {doneCount < steps.length && (
            <section className="panel-card" aria-labelledby="start-h">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.6rem' }}>
                <h2 id="start-h" className="section-title">Getting started</h2>
                <span className="text-subtle tnum" style={{ fontSize: '0.75rem' }}>{doneCount}/{steps.length}</span>
              </div>
              <div className="progress" style={{ marginBottom: '0.75rem' }}><div style={{ width: `${(doneCount / steps.length) * 100}%`, transition: 'width 0.8s var(--ease-out)' }} /></div>
              <ul className="checklist">
                {steps.map((st, i) => (
                  <li key={st.label} className={st.done ? 'done' : i === nextIdx ? 'next' : ''}>
                    <span className="check-dot">{st.done && <Check size={12} strokeWidth={3} />}</span>
                    <span className="check-text">{st.label}</span>
                    {!st.done && i === nextIdx && <button type="button" className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }} onClick={st.act}>Start</button>}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section aria-label="Quick actions" className="quick-actions">
            <button type="button" className="quick-action spot" onClick={() => openStudio({ mode: 'upload' })}><Upload /> Upload<span>A video or audio file</span></button>
            <button type="button" className="quick-action spot" onClick={() => openStudio({ mode: 'link' })}><Link2 /> YouTube link<span>Your own video</span></button>
            <button type="button" className="quick-action spot" onClick={() => go('trends')}><Sparkles /> Trends<span>What’s hot today</span></button>
            <button type="button" className="quick-action spot" onClick={() => go('review')}><Lightbulb /> Script ideas<span>Topics to record next</span></button>
          </section>
          {s.avgWatchThrough !== null && (
            <div className="stat-card spot">
              <span className="stat-label">Average watch-through</span>
              <span className="stat-value tnum"><CountUp value={s.avgWatchThrough} />%</span>
              <span className="stat-foot">latest YouTube stats</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
