"use client";

import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Home, Scissors, Inbox, Radar, BarChart3, CreditCard, Settings, Shield, LogOut, RefreshCw, Menu, X, Upload, ArrowRight, Mail,
} from 'lucide-react';
import type { DashboardData } from '@/types';
import { api, errorMessage } from '@/lib/client';
import { StudioView } from '@/components/StudioView';
import { ReviewView } from '@/components/ReviewView';
import { TrendHistoryView } from '@/components/TrendHistoryView';
import { FeedbackLoopView } from '@/components/FeedbackLoopView';
import { BillingView } from '@/components/BillingView';
import { SettingsView } from '@/components/SettingsView';
import { AdminView } from '@/components/AdminView';
import { LandingPage } from '@/components/LandingPage';
import { SectionErrorBoundary } from '@/components/SectionErrorBoundary';
import { BrandMark } from '@/components/BrandMark';

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

const OAUTH_MESSAGES: Record<string, string> = {
  youtube_state: 'The YouTube connection expired or was started elsewhere. Try again.',
  youtube_denied: 'YouTube access wasn’t granted.',
  youtube_no_refresh: 'Google didn’t grant lasting access. Remove Viralis at myaccount.google.com/permissions and connect again.',
  youtube_scope: 'Please allow uploading to YouTube when connecting.',
  youtube_failed: 'Connecting YouTube failed. Try again.',
  youtube_permission: 'Only workspace admins can connect a channel.',
  youtube_unavailable: 'Publishing to YouTube isn’t available yet.',
};

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

  const fetchData = useCallback(async () => {
    try {
      const res = await api<{ data: DashboardData }>('/api/data');
      setData(res.data);
      setLoadError(null);
    } catch (err) {
      setLoadError(errorMessage(err));
    }
  }, []);

  const setTab = useCallback((t: Tab) => {
    setTabState(t);
    setNavOpen(false);
    const url = new URL(window.location.href);
    url.search = t === 'home' ? '' : `?tab=${t}`;
    window.history.replaceState(null, '', url);
  }, []);

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
    return () => {
      clearInterval(timer);
      clearTimeout(first);
    };
  }, [authStatus, fetchData]);

  if (authStatus === 'loading') {
    return (
      <div className="center-screen" role="status">
        <RefreshCw className="animate-spin" size={24} color="var(--accent)" />
        <p className="text-muted" style={{ fontSize: '0.8125rem' }}>Loading…</p>
      </div>
    );
  }

  if (authStatus !== 'authenticated') {
    return <LandingPage onSignIn={() => router.push('/auth/signin')} onSignUp={() => router.push('/auth/signin?mode=signup')} />;
  }

  if (!data) {
    return (
      <div className="center-screen" role="status">
        {loadError ? (
          <>
            <p style={{ fontSize: '0.9rem' }}>{loadError}</p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" className="btn btn-primary" onClick={fetchData}>Try again</button>
              <button type="button" className="btn btn-ghost" onClick={() => signOut({ callbackUrl: '/' })}>Sign out</button>
            </div>
          </>
        ) : (
          <>
            <RefreshCw className="animate-spin" size={24} color="var(--accent)" />
            <p className="text-muted" style={{ fontSize: '0.8125rem' }}>Opening your workspace…</p>
          </>
        )}
      </div>
    );
  }

  const pendingReview = data.approvalQueue.filter((i) => i.clipId).length;
  const nav: { group: string; items: [Tab, string, React.ElementType, number?][] }[] = [
    { group: 'Create', items: [['home', 'Home', Home], ['projects', 'Projects', Scissors], ['review', 'Review', Inbox, pendingReview]] },
    { group: 'Insights', items: [['trends', 'Trends', Radar], ['performance', 'Performance', BarChart3]] },
    { group: 'Account', items: [['billing', 'Billing', CreditCard], ['settings', 'Settings', Settings], ...(data.user.isPlatformAdmin ? [['admin', 'Admin', Shield] as [Tab, string, React.ElementType]] : [])] },
  ];
  const [title, subtitle] = TITLES[tab];

  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">Skip to content</a>
      <header className="top-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
          <button type="button" className="icon-btn mobile-nav-toggle" onClick={() => setNavOpen((v) => !v)} aria-label={navOpen ? 'Close menu' : 'Open menu'} aria-expanded={navOpen}>
            {navOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
          <BrandMark size={24} />
          <span style={{ fontSize: '0.9375rem', fontWeight: 650 }}>Viralis</span>
          <span className="text-subtle truncate" style={{ fontSize: '0.78rem', maxWidth: 200 }}>/ {data.workspace.name}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {data.plan.source !== 'unlimited' && (
            <button type="button" className="btn btn-ghost btn-sm usage-pill" onClick={() => setTab('billing')}>
              {data.plan.source === 'none' ? 'Choose a plan' : `${Math.max(0, data.plan.limits.sourceMinutes - data.plan.used.sourceMinutes)} min left`}
            </button>
          )}
        </div>
      </header>

      <div className="app-container">
        <div className={`sidebar-overlay ${navOpen ? 'open' : ''}`} onClick={() => setNavOpen(false)} aria-hidden="true" />
        <aside className={`sidebar-nav ${navOpen ? 'open' : ''}`} aria-label="Primary">
          {nav.map(({ group, items }) => (
            <div className="sidebar-group" key={group}>
              <p className="sidebar-section-title">{group}</p>
              {items.map(([id, label, Icon, count]) => (
                <button key={id} type="button" className={`nav-link ${tab === id ? 'active' : ''}`} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}>
                  <Icon /> {label}
                  {!!count && <span className="badge badge-warning" style={{ marginLeft: 'auto' }}>{count}</span>}
                </button>
              ))}
            </div>
          ))}
          <div className="sidebar-footer">
            <div className="sidebar-user">
              <div className="avatar" aria-hidden="true">{(session?.user?.name || data.user.email || 'U')[0].toUpperCase()}</div>
              <div className="sidebar-user-meta">
                <p style={{ fontSize: '0.78rem', fontWeight: 600 }} className="truncate">{session?.user?.name || data.user.email}</p>
                <p className="text-subtle truncate" style={{ fontSize: '0.7rem' }}>{data.user.role}</p>
              </div>
              <button type="button" className="icon-btn" onClick={() => signOut({ callbackUrl: '/' })} aria-label="Sign out"><LogOut size={14} /></button>
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

          <div style={{ marginBottom: '1.25rem' }}>
            <h1 className="page-title">{title}</h1>
            <p className="text-muted" style={{ fontSize: '0.85rem' }}>{subtitle}</p>
          </div>

          <SectionErrorBoundary key={tab} section={title}>
            {tab === 'home' && <HomeView data={data} go={setTab} />}
            {tab === 'projects' && <StudioView data={data} onRefresh={fetchData} onGoToSettings={() => setTab('settings')} onGoToBilling={() => setTab('billing')} />}
            {tab === 'review' && <ReviewView data={data} onRefresh={fetchData} />}
            {tab === 'trends' && <TrendHistoryView trends={data.trends} onRefreshed={fetchData} />}
            {tab === 'performance' && <FeedbackLoopView />}
            {tab === 'billing' && <BillingView onChanged={fetchData} />}
            {tab === 'settings' && <SettingsView data={data} onRefresh={fetchData} />}
            {tab === 'admin' && data.user.isPlatformAdmin && <AdminView />}
          </SectionErrorBoundary>
        </main>
      </div>
    </div>
  );
}

function HomeView({ data, go }: { data: DashboardData; go: (t: Tab) => void }) {
  const s = data.stats;
  const processing = data.projects.filter((p) => ['queued', 'transcribing', 'analyzing'].includes(p.status));
  const reviewCount = data.approvalQueue.filter((i) => i.clipId).length;

  // One clear next step.
  const next =
    s.projects === 0
      ? { label: 'Upload your first recording', text: 'A lesson, webinar or talk you recorded. We’ll find the clips.', tab: 'projects' as Tab }
      : reviewCount > 0
        ? { label: `Review ${reviewCount} clip${reviewCount === 1 ? '' : 's'}`, text: 'Approve what’s ready, reject what isn’t.', tab: 'review' as Tab }
        : processing.length > 0
          ? { label: 'See progress', text: `${processing.length} recording${processing.length === 1 ? ' is' : 's are'} being processed.`, tab: 'projects' as Tab }
          : { label: 'Add another recording', text: 'Keep the clips coming — one recording a week is a great rhythm.', tab: 'projects' as Tab };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <section className="panel-card next-step">
        <div>
          <h2 className="section-title">{next.label}</h2>
          <p className="text-muted" style={{ fontSize: '0.85rem' }}>{next.text}</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => go(next.tab)}>
          {s.projects === 0 ? <Upload size={14} /> : <ArrowRight size={14} />} {next.label}
        </button>
      </section>

      <div className="grid-metrics">
        {[
          ['Recordings', s.projects, 'added to this workspace'],
          ['Clips found', s.clipsFound, 'suggested moments'],
          ['Exported', s.clipsExported, 'clips with a video file'],
          ['Published', s.clipsPublished, 'live on YouTube'],
          ['Watch-through', s.avgWatchThrough !== null ? `${s.avgWatchThrough}%` : '—', s.avgWatchThrough !== null ? 'average, latest stats' : 'after you publish'],
        ].map(([label, value, foot]) => (
          <div key={String(label)} className="stat-card">
            <span className="stat-label">{label}</span>
            <span className="stat-value tnum">{value}</span>
            <span className="stat-foot">{foot}</span>
          </div>
        ))}
      </div>

      {data.projects.length > 0 && (
        <section className="panel-card settings-section" aria-labelledby="recent-h">
          <h2 id="recent-h" className="section-title">Recent recordings</h2>
          <ul className="member-list">
            {data.projects.slice(0, 5).map((p) => (
              <li key={p.id}>
                <span className="truncate">{p.title}</span>
                <span className={`badge ${p.status === 'ready' ? 'badge-success' : p.status === 'failed' ? 'badge-danger' : 'badge-warning'}`}>
                  {p.status === 'ready' ? `${p.clips.filter((c) => c.status !== 'rejected').length} clips` : p.status === 'failed' ? 'Failed' : p.stage || 'Processing'}
                </span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => go('projects')}>Open</button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
