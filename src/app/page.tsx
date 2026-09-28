"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import type {
  DashboardStats, SettingsData, AgentStatus, ProjectData, ApprovalQueueItem, TrendRecord, RenderedClipData,
} from '@/types';
import {
  LayoutDashboard, Video, TrendingUp, Settings, Play, CheckCircle2, Clock, XCircle, Bot, Zap,
  History, LogOut, ClipboardCheck, RefreshCw, ChevronRight,
  Scissors, Brain, Sparkles, Flame, Search, FileText, AlertTriangle,
} from 'lucide-react';
import { RepurposeStudioView } from '@/components/RepurposeStudioView';
import { ContentLibraryView } from '@/components/ContentLibraryView';
import { FeedbackLoopView } from '@/components/FeedbackLoopView';
import { AgentStatusView } from '@/components/AgentStatusView';
import { TrendHistoryView } from '@/components/TrendHistoryView';
import { ApprovalQueueView } from '@/components/ApprovalQueueView';
import { LandingPage } from '@/components/LandingPage';
import { signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Menu, X } from 'lucide-react';

interface DashboardData {
  projects: ProjectData[];
  totalClipsCount: number;
  stats: DashboardStats;
  settings: SettingsData;
  agents: AgentStatus[];
  trends: TrendRecord[];
  approvalQueue: ApprovalQueueItem[];
  autopilotScripts: ApprovalQueueItem[];
  renderedClips: RenderedClipData[];
  renderWorkerConfigured: boolean;
}

type DataResult = { ok: true; data: DashboardData } | { ok: false; error: string };

async function loadDashboard(): Promise<DataResult> {
  try {
    const res = await fetch('/api/data');
    const json = await res.json();
    if (!json.success) return { ok: false, error: json.error || 'Could not load your workspace.' };
    return { ok: true, data: json.data };
  } catch (e) {
    console.error(e);
    return { ok: false, error: 'Could not reach the server. Check your connection and try again.' };
  }
}

function ScriptStatusBadge({ status }: { status: string }) {
  const cls = status === 'approved' ? 'badge-success' : status === 'rejected' ? 'badge-danger' : 'badge-warning';
  const Icon = status === 'approved' ? CheckCircle2 : status === 'rejected' ? XCircle : Clock;
  return (
    <span className={`badge ${cls}`} style={{ textTransform: 'capitalize', flexShrink: 0 }}>
      <Icon size={11} /> {status === 'pending' ? 'In review' : status}
    </span>
  );
}

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'repurpose', label: 'Repurpose Studio' },
  { id: 'autopilot', label: 'Autopilot Generator' },
  { id: 'queue', label: 'Approval Queue' },
  { id: 'content', label: 'Content Library' },
  { id: 'learning-loop', label: 'Learning Loop' },
  { id: 'trends', label: 'Trend Radar' },
  { id: 'agents', label: 'Agent Fleet' },
  { id: 'settings', label: 'Settings' },
];

export default function Dashboard() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('overview');
  const [loadError, setLoadError] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [studioProjectId, setStudioProjectId] = useState('');
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<DashboardData | null>(null);

  // Settings State
  const [ytId, setYtId] = useState('');
  const [igId, setIgId] = useState('');
  const [aiProvider, setAiProvider] = useState('gemini');
  const [aiApiKey, setAiApiKey] = useState('');
  const [aiModel, setAiModel] = useState('');
  const [hasAiKey, setHasAiKey] = useState(false);
  const [ytClientId, setYtClientId] = useState('');
  const [ytClientSecret, setYtClientSecret] = useState('');
  const [igAccessToken, setIgAccessToken] = useState('');
  const [savedSecrets, setSavedSecrets] = useState({
    ytClientSecret: false,
    igToken: false,
    discordWebhook: false,
    pexelsKey: false,
    elevenLabsKey: false,
  });
  // Settings inputs are hydrated once (and again after a save) — not on every
  // 30s dashboard poll, which would overwrite whatever the user is typing.
  const settingsHydrated = useRef(false);

  // Brand Settings
  const [brandName, setBrandName] = useState('Viralis');
  const [brandNiche, setBrandNiche] = useState('Technology & AI');
  const [brandTone, setBrandTone] = useState('Punchy & Viral');
  const [targetAudience, setTargetAudience] = useState('Social Media Audience');
  const [discordWebhook, setDiscordWebhook] = useState('');
  const [pexelsKey, setPexelsKey] = useState('');

  // Pro Video Settings
  const [elevenLabsKey, setElevenLabsKey] = useState('');
  const [videoStyle, setVideoStyle] = useState('Cinematic Stock');
  const [captionStyle, setCaptionStyle] = useState('Dynamic Pop');

  // Trending discovery
  const [youtubeDataApiKey, setYoutubeDataApiKey] = useState('');
  const [hasYoutubeDataKey, setHasYoutubeDataKey] = useState(false);
  const [defaultPlatforms, setDefaultPlatforms] = useState<string[]>(['instagram', 'youtube', 'tiktok']);
  const [defaultOrientations, setDefaultOrientations] = useState<string[]>(['9:16', '1:1', '16:9']);

  const applyData = useCallback((result: DataResult, rehydrateSettings = false) => {
    if (!result.ok) {
      setLoadError(result.error);
      return;
    }
    setLoadError('');
    setData(result.data);
    const s = result.data.settings;
    if (!s) return;
    setHasAiKey(!!s.hasAiKey);
    setHasYoutubeDataKey(!!s.hasYoutubeDataKey);
    setSavedSecrets({
      ytClientSecret: !!s.hasYoutubeClientSecret,
      igToken: !!s.hasInstagramToken,
      discordWebhook: !!s.hasDiscordWebhook,
      pexelsKey: !!s.hasPexelsKey,
      elevenLabsKey: !!s.hasElevenLabsKey,
    });

    if (!settingsHydrated.current || rehydrateSettings) {
      settingsHydrated.current = true;
      setYtId(s.youtubeId || '');
      setIgId(s.instagramId || '');
      setAiProvider(s.aiProvider || 'gemini');
      setAiModel(s.aiModel || '');
      setYtClientId(s.youtubeClientId || '');
      setBrandName(s.brandName || 'Viralis');
      setBrandNiche(s.brandNiche || 'Technology & AI');
      setBrandTone(s.brandTone || 'Punchy & Viral');
      setTargetAudience(s.targetAudience || 'Social Media Audience');
      setVideoStyle(s.videoStyle || 'Cinematic Stock');
      setCaptionStyle(s.captionStyle || 'Dynamic Pop');
      if (Array.isArray(s.defaultPlatforms) && s.defaultPlatforms.length) {
        setDefaultPlatforms(s.defaultPlatforms);
      }
      if (Array.isArray(s.defaultOrientations) && s.defaultOrientations.length) {
        setDefaultOrientations(s.defaultOrientations);
      }
    }
  }, []);

  const fetchData = useCallback(async (rehydrateSettings = false) => {
    applyData(await loadDashboard(), rehydrateSettings);
  }, [applyData]);
  const refresh = useCallback(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (authStatus !== 'authenticated') return;

    let cancelled = false;
    const load = () => loadDashboard().then((result) => { if (!cancelled) applyData(result); });
    load();
    const interval = setInterval(load, 30000);
    if (typeof window !== 'undefined' && window.location.search.includes('success=youtube_connected')) {
      toast.success("YouTube Account authorized successfully!", { id: 'oauth', duration: 5000 });
      window.history.replaceState(null, '', '/');
    }
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [authStatus, applyData]);

  // ⌘K / Ctrl+K focuses the jump-to search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleForceRun = async () => {
    setIsRunning(true);
    toast.loading('Starting Viralis autopilot workflow...', { id: 'workflow' });
    
    try {
      const res = await fetch('/api/trigger', { method: 'POST' });
      const responseData = await res.json();
      
      if (responseData.success) {
        toast.success(responseData.message || 'Done — check the Approval Queue.', { id: 'workflow', duration: 6000 });
      } else {
        toast.error(responseData.error || responseData.message || 'Workflow failed. Check the AI key in Settings.', { id: 'workflow', duration: 8000 });
      }
      fetchData();
    } catch {
      toast.error('Network error triggering workflow.', { id: 'workflow' });
    } finally {
      setIsRunning(false);
    }
  };

  const saveSettings = async (toastId?: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          youtubeId: ytId,
          instagramId: igId,
          aiProvider,
          aiApiKey: aiApiKey || undefined,
          aiModel,
          youtubeClientId: ytClientId,
          youtubeClientSecret: ytClientSecret || undefined,
          instagramAccessToken: igAccessToken || undefined,
          brandName,
          brandNiche,
          brandTone,
          targetAudience,
          discordWebhookUrl: discordWebhook || undefined,
          pexelsApiKey: pexelsKey || undefined,
          elevenLabsApiKey: elevenLabsKey || undefined,
          videoStyle,
          captionStyle,
          youtubeDataApiKey: youtubeDataApiKey || undefined,
          defaultPlatforms,
          defaultOrientations,
        })
      });
      const responseData = await res.json();
      if (responseData.success) {
        if (toastId) toast.success("Configuration saved successfully!", { id: toastId });
        setAiApiKey('');
        setYtClientSecret('');
        setIgAccessToken('');
        setDiscordWebhook('');
        setPexelsKey('');
        setElevenLabsKey('');
        setYoutubeDataApiKey('');
        fetchData(true);
        return true;
      }
      if (toastId) toast.error(responseData.error || "Failed to save settings.", { id: toastId });
      return false;
    } catch {
      if (toastId) toast.error("Error saving settings.", { id: toastId });
      return false;
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    toast.loading('Saving Viralis configuration...', { id: 'settings' });
    await saveSettings('settings');
  };

  const goToTab = (tab: string) => {
    setActiveTab(tab);
    setMobileNavOpen(false);
    setSearch('');
  };

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    const pages = TABS.filter((t) => t.label.toLowerCase().includes(q) || t.id.includes(q)).map((t) => ({
      key: `tab-${t.id}`,
      label: t.label,
      hint: 'Page',
      go: () => { setActiveTab(t.id); setMobileNavOpen(false); setSearch(''); searchRef.current?.blur(); },
    }));
    const projectHits = (data?.projects || [])
      .filter((p) => p.title.toLowerCase().includes(q) || (p.channel || '').toLowerCase().includes(q))
      .slice(0, 6)
      .map((p) => ({
        key: `project-${p.id}`,
        label: p.title,
        hint: 'Project',
        go: () => { setStudioProjectId(p.id); setActiveTab('repurpose'); setSearch(''); searchRef.current?.blur(); },
      }));
    return [...pages, ...projectHits].slice(0, 8);
  }, [search, data?.projects]);

  const handleYoutubeLogin = async () => {
    if (!ytClientId || (!ytClientSecret && !savedSecrets.ytClientSecret)) {
      toast.error("Add your GCP Client ID and Client Secret first!");
      return;
    }
    // The OAuth route reads these from the saved Settings row, not from
    // whatever's currently typed in the form — save first so a client
    // ID/secret typed but not yet saved doesn't send the user into an
    // OAuth flow that then fails with "missing credentials".
    toast.loading('Saving credentials before connecting…', { id: 'yt-oauth' });
    const saved = await saveSettings();
    if (!saved) {
      toast.error('Could not save your credentials — try again.', { id: 'yt-oauth' });
      return;
    }
    toast.dismiss('yt-oauth');
    window.location.href = '/api/auth/youtube';
  };

  if (authStatus === 'authenticated' && !data && loadError) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--background)', gap: '0.85rem', padding: '1.5rem', textAlign: 'center' }}>
        <AlertTriangle size={26} color="var(--red)" />
        <p style={{ fontSize: '0.875rem', color: 'var(--text-2)', maxWidth: 420 }}>{loadError}</p>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-primary" onClick={() => fetchData()}>
            <RefreshCw size={14} /> Try again
          </button>
          <button className="btn btn-secondary" onClick={() => signOut()}>
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </div>
    );
  }

  if (authStatus === 'loading' || (authStatus === 'authenticated' && !data)) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--background)', gap: '0.75rem' }}>
        <RefreshCw className="animate-spin" size={28} color="var(--primary)" />
        <p className="text-muted" style={{ fontSize: '0.8125rem', fontWeight: 500 }}>Connecting to Viralis Studio...</p>
      </div>
    );
  }

  if (authStatus !== 'authenticated') {
    return <LandingPage onSignIn={() => router.push('/auth/signin')} />;
  }

  const {
    projects = [],
    totalClipsCount = 0,
    stats = { totalGenerated: 0, successCount: 0, views: 0, engagement: 0, subs: 0, revenue: 0 },
    settings = {} as SettingsData,
    autopilotScripts = [],
    renderedClips = [],
    renderWorkerConfigured = false,
  } = data || {};

  const pendingQueueCount = data?.approvalQueue?.length || 0;

  const openProject = (projectId: string) => {
    setStudioProjectId(projectId);
    goToTab('repurpose');
  };

  return (
    <div className="app-shell">
      {/* Top Header Bar (YouTube Studio / Meta Style) */}
      <header className="top-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', minWidth: 0 }}>
          <button
            type="button"
            className="icon-btn mobile-nav-toggle"
            onClick={() => setMobileNavOpen((v) => !v)}
            aria-label={mobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileNavOpen}
          >
            {mobileNavOpen ? <X size={16} /> : <Menu size={16} />}
          </button>

          {/* Logo Mark */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
            <div style={{ width: '26px', height: '26px', borderRadius: '7px', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={15} color="#fff" fill="#fff" />
            </div>
            <span style={{ fontSize: '0.9375rem', fontWeight: 650, letterSpacing: '-0.02em', color: 'var(--text)' }}>
              Viralis
            </span>
          </div>

          <span className="divider-v" />

          {/* Workspace (brand) name */}
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0 }}>
            <span style={{ width: '18px', height: '18px', borderRadius: '5px', background: 'var(--surface-3)', border: '1px solid var(--border-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.625rem', fontWeight: 700, color: 'var(--text-2)', flexShrink: 0 }}>
              {(settings.brandName || 'V')[0].toUpperCase()}
            </span>
            <span style={{ fontSize: '0.8125rem', fontWeight: 550, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {settings.brandName || 'My workspace'}
            </span>
          </span>
        </div>

        {/* Center Search — jump to a page or project */}
        <div className="header-search" style={{ position: 'relative' }}>
          <Search aria-hidden="true" />
          <input
            ref={searchRef}
            type="text"
            placeholder="Jump to a page or project…"
            aria-label="Jump to a page or project"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setSearchOpen(true); }}
            onFocus={() => setSearchOpen(true)}
            onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && searchResults[0]) {
                searchResults[0].go();
              } else if (e.key === 'Escape') {
                setSearch('');
                (e.target as HTMLInputElement).blur();
              }
            }}
          />
          <kbd>⌘K</kbd>
          {searchOpen && search.trim() && (
            <div className="search-results" role="listbox">
              {searchResults.length === 0 ? (
                <p className="text-subtle" style={{ fontSize: '0.75rem', padding: '0.6rem 0.75rem' }}>No matches</p>
              ) : (
                searchResults.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    role="option"
                    aria-selected={false}
                    className="search-result"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={r.go}
                  >
                    <span>{r.label}</span>
                    <span className="text-subtle" style={{ fontSize: '0.6875rem' }}>{r.hint}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Right controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="button"
            className="badge badge-neutral"
            style={{ gap: '0.4rem', cursor: 'pointer', border: 'none' }}
            onClick={() => goToTab('settings')}
            title={settings.hasAiKey ? `AI: ${settings.aiProvider}` : 'Add an AI key in Settings'}
          >
            <span className={settings.hasAiKey ? 'pulse-dot' : ''} style={{ width: 5, height: 5, borderRadius: '50%', background: settings.hasAiKey ? 'var(--green)' : 'var(--amber, #f59e0b)', display: 'inline-block' }} aria-hidden="true"></span>
            {settings.hasAiKey ? 'AI connected' : 'AI key needed'}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {authStatus === 'authenticated' && session?.user?.image ? (
              <img src={session.user.image} alt={session.user.name ? `${session.user.name}'s avatar` : 'Your account'} style={{ width: '26px', height: '26px', borderRadius: '50%', border: '1px solid var(--border-2)' }} />
            ) : (
              <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: 'var(--accent-subtle)', border: '1px solid var(--accent-line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6875rem', fontWeight: 600, color: '#b3a4f0' }} aria-hidden="true">
                {session?.user?.name?.[0]?.toUpperCase() || 'U'}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="app-container">
        {/* Mobile drawer backdrop */}
        <div
          className={`sidebar-overlay ${mobileNavOpen ? 'open' : ''}`}
          onClick={() => setMobileNavOpen(false)}
          aria-hidden="true"
        ></div>

        {/* Sidebar Navigation */}
        <aside className={`sidebar-nav ${mobileNavOpen ? 'open' : ''}`} aria-label="Primary">
          <div className="sidebar-group">
            <p className="sidebar-section-title">Studio</p>
            <button className={`nav-link ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => goToTab('overview')}>
              <LayoutDashboard /> Overview
            </button>
            <button className={`nav-link ${activeTab === 'repurpose' ? 'active' : ''}`} onClick={() => goToTab('repurpose')}>
              <Scissors /> Repurpose Studio
            </button>
            <button className={`nav-link ${activeTab === 'autopilot' ? 'active' : ''}`} onClick={() => goToTab('autopilot')}>
              <Sparkles /> Autopilot Generator
            </button>
          </div>

          <div className="sidebar-group">
            <p className="sidebar-section-title">Distribution</p>
            <button className={`nav-link ${activeTab === 'queue' ? 'active' : ''}`} onClick={() => goToTab('queue')}>
              <ClipboardCheck /> Approval Queue
              {pendingQueueCount > 0 && (
                <span className="badge badge-warning" style={{ marginLeft: 'auto' }}>{pendingQueueCount}</span>
              )}
            </button>
            <button className={`nav-link ${activeTab === 'content' ? 'active' : ''}`} onClick={() => goToTab('content')}>
              <Video /> Content Library
            </button>
          </div>

          <div className="sidebar-group">
            <p className="sidebar-section-title">Intelligence</p>
            <button className={`nav-link ${activeTab === 'learning-loop' ? 'active' : ''}`} onClick={() => goToTab('learning-loop')}>
              <Brain /> Learning Loop
            </button>
            <button className={`nav-link ${activeTab === 'trends' ? 'active' : ''}`} onClick={() => goToTab('trends')}>
              <History /> Trend Radar
            </button>
          </div>

          <div className="sidebar-group">
            <p className="sidebar-section-title">System</p>
            <button className={`nav-link ${activeTab === 'agents' ? 'active' : ''}`} onClick={() => goToTab('agents')}>
              <Bot /> Agent Fleet
            </button>
            <button className={`nav-link ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => goToTab('settings')}>
              <Settings /> Settings
            </button>
          </div>

          <div className="sidebar-footer">
            {authStatus === 'authenticated' ? (
              <div className="sidebar-user">
                {session?.user?.image ? (
                  <img src={session.user.image} alt="" style={{ width: '26px', height: '26px', borderRadius: '50%', border: '1px solid var(--border-2)' }} />
                ) : (
                  <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: 'var(--accent-subtle)', border: '1px solid var(--accent-line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6875rem', fontWeight: 600, color: '#b3a4f0', flexShrink: 0 }}>
                    {session?.user?.name?.[0]?.toUpperCase() || 'U'}
                  </div>
                )}
                <div className="sidebar-user-meta">
                  <p style={{ fontSize: '0.78125rem', fontWeight: 550, color: 'var(--text)' }}>{session?.user?.name || 'Creator'}</p>
                  <p style={{ fontSize: '0.6875rem', color: 'var(--text-3)' }}>{session?.user?.email || 'Pro plan'}</p>
                </div>
                <button onClick={() => signOut()} className="icon-btn" style={{ flexShrink: 0 }} aria-label="Sign out">
                  <LogOut size={14} />
                </button>
              </div>
            ) : (
              <button onClick={() => router.push('/auth/signin')} className="btn btn-secondary" style={{ width: '100%' }}>
                Sign in
              </button>
            )}
          </div>
        </aside>

        {/* Main Viewport Content Area */}
        <main className="main-viewport">
          {/* Header Action Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h1 className="page-title" style={{ textTransform: 'capitalize' }}>
                {activeTab === 'repurpose' ? 'Repurpose Studio'
                  : activeTab === 'autopilot' ? 'Autopilot Trend Generator'
                  : activeTab === 'learning-loop' ? 'Learning Loop'
                  : activeTab === 'agents' ? 'Agent Fleet'
                  : activeTab === 'queue' ? 'Approval Queue'
                  : activeTab === 'content' ? 'Content Library'
                  : activeTab === 'trends' ? 'Trend Radar'
                  : activeTab.replace('-', ' ')}
              </h1>
              <p className="text-muted" style={{ fontSize: '0.8125rem', marginTop: '0.35rem', maxWidth: '620px' }}>
                {activeTab === 'overview' && "Video repurposing, autonomous generation, and performance learning at a glance."}
                {activeTab === 'repurpose' && "Turn long-form video into high-retention 9:16 shorts with automatic reframing and dynamic subtitles."}
                {activeTab === 'autopilot' && "Scan trends and autonomously write a script, then send it to your Approval Queue for review."}
                {activeTab === 'queue' && "Review repurposed clips and autopilot scripts. Approving a clip renders the real video."}
                {activeTab === 'learning-loop' && "Real performance of your published clips — watch-through, winning hook styles, and drop-offs."}
                {activeTab === 'trends' && "Every topic Autopilot has considered, with its AI viability verdict."}
                {activeTab === 'agents' && "The AI agents behind the pipeline — and a console to ask any of them directly."}
                {activeTab === 'settings' && "API keys, OAuth connections, and brand voice."}
                {activeTab === 'content' && "Every rendered clip and approved autopilot script in one place."}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {activeTab === 'overview' && (
                <>
                  <button className="btn btn-secondary" onClick={() => setActiveTab('repurpose')}>
                    <Scissors /> Open Studio
                  </button>
                  <button className="btn btn-primary" onClick={handleForceRun} disabled={isRunning}>
                    {isRunning ? <RefreshCw className="animate-spin" /> : <Play />}
                    {isRunning ? 'Running…' : 'Run Autopilot'}
                  </button>
                </>
              )}
              {activeTab === 'autopilot' && (
                <button className="btn btn-primary" onClick={handleForceRun} disabled={isRunning}>
                  {isRunning ? <RefreshCw className="animate-spin" /> : <Sparkles />}
                  {isRunning ? 'Processing…' : 'Run Autopilot'}
                </button>
              )}
            </div>
          </div>

          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Metric row */}
              <div className="grid-metrics">
                {[
                  { label: 'Repurposed highlights', value: totalClipsCount, icon: Scissors, foot: 'Ranked by AI virality' },
                  { label: 'Autopilot scripts', value: autopilotScripts.length, icon: FileText, foot: 'Written by Autopilot' },
                  { label: 'Avg. watch-through', value: stats.avgWatchThrough != null ? `${stats.avgWatchThrough}%` : '—', icon: TrendingUp, foot: stats.avgWatchThrough != null ? 'Across published clips' : 'No published metrics yet' },
                  { label: 'In review', value: pendingQueueCount, icon: ClipboardCheck, foot: 'Awaiting approval' },
                ].map((m) => {
                  const Icon = m.icon;
                  return (
                    <div key={m.label} className="stat-card">
                      <div className="stat-head">
                        <span className="stat-label">{m.label}</span>
                        <span className="stat-icon"><Icon /></span>
                      </div>
                      <p className="stat-value">{m.value}</p>
                      <span className="stat-foot">{m.foot}</span>
                    </div>
                  );
                })}
              </div>

              {/* Two engines */}
              <div className="grid-cols-2">
                <div className="panel-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span className="stat-icon" style={{ color: 'var(--accent)' }}><Scissors /></span>
                    <span className="section-title">Repurpose Engine</span>
                  </div>
                  <p className="text-muted" style={{ fontSize: '0.8125rem' }}>
                    One long-form upload becomes ten platform-native shorts — reframed to 9:16 with burned-in captions.
                  </p>
                  <button onClick={() => setActiveTab('repurpose')} className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start', marginTop: '0.15rem' }}>
                    Open Repurpose Studio <ChevronRight />
                  </button>
                </div>
                <div className="panel-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span className="stat-icon" style={{ color: 'var(--accent)' }}><Sparkles /></span>
                    <span className="section-title">Autopilot Engine</span>
                  </div>
                  <p className="text-muted" style={{ fontSize: '0.8125rem' }}>
                    Scans what’s trending in your niche and writes a ready-to-shoot script, hook, and SEO metadata.
                  </p>
                  <button onClick={() => setActiveTab('autopilot')} className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start', marginTop: '0.15rem' }}>
                    Open Autopilot Generator <ChevronRight />
                  </button>
                </div>
              </div>

              {/* Ingested Episodes List */}
              {projects.length > 0 && (
                <div className="panel">
                  <div className="panel-header">
                    <span className="section-title">Active repurposing projects</span>
                    <button onClick={() => setActiveTab('repurpose')} className="btn btn-ghost btn-sm">
                      Open Studio <ChevronRight />
                    </button>
                  </div>

                  <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Project Episode</th>
                        <th>Source</th>
                        <th>Extracted Highlights</th>
                        <th>Top Virality Score</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projects.map((p: ProjectData) => {
                        const topScore = p.clips && p.clips.length > 0
                          ? Math.max(...p.clips.map(c => c.viralityScore))
                          : null;

                        return (
                          <tr key={p.id}>
                            <td style={{ fontWeight: 600, color: 'var(--foreground)' }}>{p.title}</td>
                            <td>
                              <span className="badge badge-neutral" style={{ textTransform: 'uppercase', fontSize: '0.625rem' }}>
                                {p.sourceType}
                              </span>
                            </td>
                            <td>
                              {p.status === 'transcribing' ? 'Transcribing…'
                                : p.status === 'processing' ? 'Analyzing…'
                                : p.status === 'failed' ? <span style={{ color: 'var(--red)' }}>Failed</span>
                                : `${p.clips?.length || 0} clips surfaced`}
                            </td>
                            <td>
                              {topScore != null ? (
                                <span className="badge badge-success" style={{ fontWeight: 700 }}>
                                  <Flame size={11} /> {topScore}/100
                                </span>
                              ) : (
                                <span className="text-subtle">—</span>
                              )}
                            </td>
                            <td>
                              <button onClick={() => openProject(p.id)} className="btn btn-secondary" style={{ fontSize: '0.6875rem', padding: '0.25rem 0.55rem' }}>
                                Open clips
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </div>
                </div>
              )}

              {/* Recent Autopilot scripts */}
              <div className="panel">
                <div className="panel-header">
                  <span className="section-title">Recent autopilot scripts</span>
                  <button onClick={() => setActiveTab('autopilot')} className="btn btn-ghost btn-sm">
                    View all <ChevronRight />
                  </button>
                </div>

                {autopilotScripts.length === 0 ? (
                  <div className="panel-empty">
                    <Sparkles style={{ width: 20, height: 20, margin: '0 auto 0.6rem', opacity: 0.5 }} />
                    <p>No autopilot scripts yet. Run the autopilot to write your first one.</p>
                  </div>
                ) : (
                  <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Topic</th>
                        <th>Status</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {autopilotScripts.slice(0, 5).map((v) => (
                        <tr key={v.id}>
                          <td style={{ fontWeight: 600 }}>{v.seoTitle || v.topic}</td>
                          <td><ScriptStatusBadge status={v.status} /></td>
                          <td className="text-muted">{new Date(v.createdAt).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* REPURPOSE STUDIO TAB */}
          {activeTab === 'repurpose' && (
            <RepurposeStudioView
              projects={projects}
              onRefresh={refresh}
              selectedProjectId={studioProjectId}
              onSelectProject={setStudioProjectId}
              renderWorkerConfigured={renderWorkerConfigured}
              defaultPlatforms={defaultPlatforms}
              defaultOrientations={defaultOrientations}
              defaultCaptionStyle={captionStyle}
            />
          )}

          {/* AUTOPILOT GENERATOR TAB */}
          {activeTab === 'autopilot' && (
            <div className="panel-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--surface-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
                <div>
                  <h3 style={{ fontSize: '0.9375rem', fontWeight: 700 }}>Autopilot scripts</h3>
                  <p className="text-subtle" style={{ fontSize: '0.75rem' }}>Each run picks a trending topic for your niche and writes a script, hook and SEO metadata, then sends it to the Approval Queue. Turning scripts into videos isn&apos;t built yet.</p>
                </div>
                <span className="badge badge-neutral">{autopilotScripts.length} scripts</span>
              </div>

              {autopilotScripts.length === 0 ? (
                <div style={{ padding: '3.5rem', textAlign: 'center' }}>
                  <p className="text-muted" style={{ fontSize: '0.8125rem' }}>No scripts yet. Click &quot;Run Autopilot&quot; to write one.</p>
                </div>
              ) : (
                <div className="grid-cols-3" style={{ padding: '1.25rem' }}>
                  {autopilotScripts.map((v) => (
                    <div key={v.id} className="panel-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'flex-start' }}>
                        <h4 style={{ fontSize: '0.8125rem', fontWeight: 700, lineHeight: 1.35 }}>{v.seoTitle || v.topic}</h4>
                        <ScriptStatusBadge status={v.status} />
                      </div>
                      <p className="text-muted" style={{ fontSize: '0.75rem', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {v.script}
                      </p>
                      <p className="text-subtle" style={{ fontSize: '0.7rem', marginTop: 'auto' }}>
                        {v.topic} · {new Date(v.createdAt).toLocaleDateString()}
                      </p>
                      {v.status === 'pending' && (
                        <button className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => goToTab('queue')}>
                          Review in queue <ChevronRight />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* APPROVAL QUEUE TAB */}
          {activeTab === 'queue' && (
            <ApprovalQueueView items={data?.approvalQueue || []} onRefresh={refresh} />
          )}

          {/* CONTENT LIBRARY TAB */}
          {activeTab === 'content' && (
            <ContentLibraryView
              renderedClips={renderedClips}
              autopilotScripts={autopilotScripts}
              onOpenProject={openProject}
            />
          )}

          {/* LEARNING LOOP TAB */}
          {activeTab === 'learning-loop' && (
            <FeedbackLoopView />
          )}

          {/* TREND RADAR TAB */}
          {activeTab === 'trends' && (
            <TrendHistoryView trends={data?.trends || []} />
          )}

          {/* AI AGENTS TAB */}
          {activeTab === 'agents' && (
            <AgentStatusView agents={data?.agents || []} />
          )}

          {/* SETTINGS TAB */}
          {activeTab === 'settings' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* AI Engine */}
                <div className="panel-card">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.9rem' }}>
                    <h3 className="section-title">AI Engine</h3>
                    <span className={`badge ${hasAiKey ? 'badge-success' : 'badge-warning'}`}>
                      {hasAiKey ? 'Key set' : 'No key'}
                    </span>
                  </div>
                  <p className="text-muted" style={{ fontSize: '0.8125rem', marginBottom: '1rem' }}>
                    Powers highlight detection, per-platform copy, and trend analysis. Gemini and Groq both have a free tier with no card.
                  </p>
                  <div className="grid-cols-3">
                    <div className="form-group">
                      <label className="form-label">Provider</label>
                      <select className="input-field" value={aiProvider} onChange={(e) => setAiProvider(e.target.value)}>
                        <option value="gemini">Google Gemini — free</option>
                        <option value="groq">Groq — free</option>
                        <option value="openai">OpenAI — paid</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">API key</label>
                      <input
                        type="password"
                        value={aiApiKey}
                        onChange={(e) => setAiApiKey(e.target.value)}
                        placeholder={hasAiKey ? '•••••••• (saved — leave blank to keep)' : 'Paste key'}
                        className="input-field"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Model (optional)</label>
                      <input
                        type="text"
                        value={aiModel}
                        onChange={(e) => setAiModel(e.target.value)}
                        placeholder={aiProvider === 'gemini' ? 'gemini-flash-latest' : aiProvider === 'groq' ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini'}
                        className="input-field"
                      />
                    </div>
                  </div>
                  {settings.aiKeySource === 'env' && (
                    <p className="text-subtle" style={{ fontSize: '0.75rem', marginTop: '0.75rem' }}>
                      Using the {settings.aiProvider} key from the server environment. Paste a key above to use a different provider.
                    </p>
                  )}
                  <p className="text-subtle" style={{ fontSize: '0.75rem', marginTop: '0.75rem' }}>
                    Get a free key:{' '}
                    {aiProvider === 'gemini' && <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-bright)' }}>aistudio.google.com/apikey</a>}
                    {aiProvider === 'groq' && <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-bright)' }}>console.groq.com/keys</a>}
                    {aiProvider === 'openai' && <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-bright)' }}>platform.openai.com/api-keys</a>}
                  </p>
                </div>

                {/* Trending Discovery */}
                <div className="panel-card">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.9rem' }}>
                    <h3 className="section-title">Trending Discovery</h3>
                    <span className={`badge ${hasYoutubeDataKey ? 'badge-success' : 'badge-warning'}`}>
                      {hasYoutubeDataKey ? 'Key set' : 'No key'}
                    </span>
                  </div>
                  <p className="text-muted" style={{ fontSize: '0.8125rem', marginBottom: '1rem' }}>
                    Powers the trending-video list in Repurpose Studio. Free — no card required.
                  </p>
                  <div className="form-group" style={{ maxWidth: 440 }}>
                    <label className="form-label">YouTube Data API Key</label>
                    <input
                      type="password"
                      value={youtubeDataApiKey}
                      onChange={(e) => setYoutubeDataApiKey(e.target.value)}
                      placeholder={hasYoutubeDataKey ? '•••••••• (saved — leave blank to keep)' : 'AIza...'}
                      className="input-field"
                    />
                  </div>
                  <p className="text-subtle" style={{ fontSize: '0.75rem', marginTop: '0.6rem' }}>
                    Get a free key: <a href="https://console.cloud.google.com/apis/library/youtube.googleapis.com" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-bright)' }}>console.cloud.google.com</a> — enable &quot;YouTube Data API v3&quot;, then create an API key under Credentials.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1.1rem' }}>
                    <span className="form-label">Default platforms</span>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      {(['instagram', 'youtube', 'linkedin', 'twitter', 'tiktok'] as const).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setDefaultPlatforms((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p])}
                          className={`filter-chip ${defaultPlatforms.includes(p) ? 'active' : ''}`}
                          style={{ textTransform: 'capitalize' }}
                        >
                          {p === 'twitter' ? 'X' : p}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.9rem' }}>
                    <span className="form-label">Default orientations</span>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      {(['9:16', '1:1', '16:9'] as const).map((o) => (
                        <button
                          key={o}
                          type="button"
                          onClick={() => setDefaultOrientations((prev) => prev.includes(o) ? prev.filter((x) => x !== o) : [...prev, o])}
                          className={`filter-chip ${defaultOrientations.includes(o) ? 'active' : ''}`}
                        >
                          {o}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Platform Connections */}
                <div className="grid-cols-2">
                  <div className="panel-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <h3 style={{ fontSize: '0.875rem', fontWeight: 700 }}>YouTube OAuth Connection</h3>
                      <span className={`badge ${settings?.hasYoutubeAuth ? 'badge-success' : 'badge-neutral'}`}>
                        {settings?.hasYoutubeAuth ? 'Authorized' : 'Not Connected'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div className="form-group">
                        <label className="form-label">GCP Client ID</label>
                        <input type="text" value={ytClientId} onChange={(e) => setYtClientId(e.target.value)} placeholder="...apps.googleusercontent.com" className="input-field" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">GCP Client Secret</label>
                        <input type="password" value={ytClientSecret} onChange={(e) => setYtClientSecret(e.target.value)} placeholder={savedSecrets.ytClientSecret ? '•••••••• (saved — leave blank to keep)' : 'GOCSPX-...'} className="input-field" />
                      </div>
                      <button type="button" className="btn btn-secondary" style={{ fontSize: '0.75rem' }} onClick={handleYoutubeLogin}>
                        Authorize YouTube Account
                      </button>
                    </div>
                  </div>

                  <div className="panel-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <h3 style={{ fontSize: '0.875rem', fontWeight: 700 }}>Instagram Graph API</h3>
                      <span className={`badge ${savedSecrets.igToken ? 'badge-success' : 'badge-neutral'}`}>
                        {savedSecrets.igToken ? 'Connected' : 'Not Connected'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div className="form-group">
                        <label className="form-label">Instagram Business Account ID</label>
                        <input type="text" value={igId} onChange={(e) => setIgId(e.target.value)} placeholder="178414..." className="input-field" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Page Access Token</label>
                        <input type="password" value={igAccessToken} onChange={(e) => setIgAccessToken(e.target.value)} placeholder={savedSecrets.igToken ? '•••••••• (saved — leave blank to keep)' : 'EAA...'} className="input-field" />
                      </div>
                      <p className="text-subtle" style={{ fontSize: '0.72rem' }}>
                        Saved for auto-publishing, which isn&apos;t built yet — download rendered clips from the Content Library to post them.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Brand Identity & Pro Audio */}
                <div className="grid-cols-2">
                  <div className="panel-card">
                    <h3 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.75rem' }}>Brand Identity</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div className="form-group">
                        <label className="form-label">Product / Brand Name</label>
                        <input type="text" value={brandName} onChange={(e) => setBrandName(e.target.value)} className="input-field" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Niche / Industry</label>
                        <input type="text" value={brandNiche} onChange={(e) => setBrandNiche(e.target.value)} className="input-field" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Tone of Voice</label>
                        <input type="text" value={brandTone} onChange={(e) => setBrandTone(e.target.value)} className="input-field" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Target Audience</label>
                        <input type="text" value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} className="input-field" />
                      </div>
                    </div>
                  </div>

                  <div className="panel-card">
                    <h3 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.35rem' }}>Media Assets & Voice</h3>
                    <p className="text-subtle" style={{ fontSize: '0.72rem', marginBottom: '0.75rem' }}>
                      Only the subtitle style is used today (for rendered clips). The keys and video style are saved for the upcoming script-to-video pipeline.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div className="form-group">
                        <label className="form-label">ElevenLabs API Key (Hyper-Realistic TTS)</label>
                        <input type="password" value={elevenLabsKey} onChange={(e) => setElevenLabsKey(e.target.value)} placeholder={savedSecrets.elevenLabsKey ? '•••••••• (saved — leave blank to keep)' : 'API Key...'} className="input-field" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Pexels API Key (Stock B-Roll)</label>
                        <input type="password" value={pexelsKey} onChange={(e) => setPexelsKey(e.target.value)} placeholder={savedSecrets.pexelsKey ? '•••••••• (saved — leave blank to keep)' : 'API Key...'} className="input-field" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Video Style</label>
                        <select value={videoStyle} onChange={(e) => setVideoStyle(e.target.value)} className="input-field">
                          <option value="Cinematic Stock">Cinematic Stock Footage</option>
                          <option value="AI Art Transitions">AI Art Transitions</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Subtitle Style Preset</label>
                        <select value={captionStyle} onChange={(e) => setCaptionStyle(e.target.value)} className="input-field">
                          <option value="Dynamic Pop">Dynamic Pop (Hormozi Style)</option>
                          <option value="Minimalist">Minimalist / Clean</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notifications */}
                <div className="panel-card">
                  <h3 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.65rem' }}>Notifications & Alerts</h3>
                  <div className="form-group">
                    <label className="form-label">Discord Webhook URL (Alerts on Highlight Extraction & Video Generation)</label>
                    <input type="password" value={discordWebhook} onChange={(e) => setDiscordWebhook(e.target.value)} placeholder={savedSecrets.discordWebhook ? '•••••••• (saved — leave blank to keep)' : 'https://discord.com/api/webhooks/...'} className="input-field" />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="submit" className="btn btn-primary" style={{ padding: '0.65rem 1.75rem' }}>
                    Save All Settings
                  </button>
                </div>
              </form>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
