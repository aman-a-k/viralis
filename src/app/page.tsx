"use client";

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { VideoData, DashboardStats, SettingsData, AgentStatus, ProjectData } from '@/types';
import { 
  LayoutDashboard, Video, TrendingUp, Settings, Play, CheckCircle2, Clock, XCircle, Bot, Zap, 
  History, LogOut, User as UserIcon, ClipboardCheck, RefreshCw, BarChart2, ChevronRight, 
  Scissors, Brain, Sparkles, Flame, Sliders, Send, Search, Bell, Command, ChevronDown, 
  Layers, ExternalLink
} from 'lucide-react';
import { RepurposeStudioView } from '@/components/RepurposeStudioView';
import { FeedbackLoopView } from '@/components/FeedbackLoopView';
import { AgentStatusView } from '@/components/AgentStatusView';
import { TrendHistoryView } from '@/components/TrendHistoryView';
import { ApprovalQueueView } from '@/components/ApprovalQueueView';
import { LandingPage } from '@/components/LandingPage';
import { signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Menu, X } from 'lucide-react';

export default function Dashboard() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [data, setData] = useState<{
    videos: VideoData[];
    projects: ProjectData[];
    totalClipsCount: number;
    stats: DashboardStats;
    settings: SettingsData;
    agents: AgentStatus[];
    trends: any[];
    approvalQueue: any[];
  } | null>(null);

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
  
  // Brand Settings
  const [brandName, setBrandName] = useState('Viralis');
  const [brandNiche, setBrandNiche] = useState('Technology & AI');
  const [brandTone, setBrandTone] = useState('Punchy & Viral');
  const [targetAudience, setTargetAudience] = useState('Social Media Audience');
  const [discordWebhook, setDiscordWebhook] = useState('');
  const [pexelsKey, setPexelsKey] = useState('');
  
  // Pro Video Settings
  const [elevenLabsKey, setElevenLabsKey] = useState('');
  const [pixabayKey, setPixabayKey] = useState('');
  const [videoStyle, setVideoStyle] = useState('Cinematic Stock');
  const [captionStyle, setCaptionStyle] = useState('Dynamic Pop');

  // Trending discovery
  const [youtubeDataApiKey, setYoutubeDataApiKey] = useState('');
  const [hasYoutubeDataKey, setHasYoutubeDataKey] = useState(false);
  const [defaultPlatforms, setDefaultPlatforms] = useState<string[]>(['instagram', 'youtube', 'linkedin', 'twitter', 'tiktok']);
  const [defaultOrientations, setDefaultOrientations] = useState<string[]>(['9:16', '1:1', '16:9']);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/data');
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        if (json.data.settings) {
          setYtId(json.data.settings.youtubeId || '');
          setIgId(json.data.settings.instagramId || '');
          setAiProvider(json.data.settings.aiProvider || 'gemini');
          setAiModel(json.data.settings.aiModel || '');
          setHasAiKey(!!json.data.settings.hasAiKey);
          setYtClientId(json.data.settings.youtubeClientId || '');
          setYtClientSecret(json.data.settings.youtubeClientSecret || '');
          setIgAccessToken(json.data.settings.instagramAccessToken || '');
          setBrandName(json.data.settings.brandName || 'Viralis');
          setBrandNiche(json.data.settings.brandNiche || 'Technology & AI');
          setBrandTone(json.data.settings.brandTone || 'Punchy & Viral');
          setTargetAudience(json.data.settings.targetAudience || 'Social Media Audience');
          setDiscordWebhook(json.data.settings.discordWebhookUrl || '');
          setPexelsKey(json.data.settings.pexelsApiKey || '');
          setElevenLabsKey(json.data.settings.elevenLabsApiKey || '');
          setPixabayKey(json.data.settings.pixabayApiKey || '');
          setVideoStyle(json.data.settings.videoStyle || 'Cinematic Stock');
          setCaptionStyle(json.data.settings.captionStyle || 'Dynamic Pop');
          setHasYoutubeDataKey(!!json.data.settings.hasYoutubeDataKey);
          if (json.data.settings.brandNiche) setBrandNiche(json.data.settings.brandNiche);
          if (Array.isArray(json.data.settings.defaultPlatforms) && json.data.settings.defaultPlatforms.length) {
            setDefaultPlatforms(json.data.settings.defaultPlatforms);
          }
          if (Array.isArray(json.data.settings.defaultOrientations) && json.data.settings.defaultOrientations.length) {
            setDefaultOrientations(json.data.settings.defaultOrientations);
          }
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authStatus === 'loading') return;
    if (authStatus !== 'authenticated') {
      setLoading(false);
      return;
    }

    fetchData();
    const interval = setInterval(fetchData, 30000);
    if (typeof window !== 'undefined' && window.location.search.includes('success=youtube_connected')) {
      toast.success("YouTube Account authorized successfully!", { id: 'oauth', duration: 5000 });
      window.history.replaceState(null, '', '/');
    }
    return () => clearInterval(interval);
  }, [authStatus]);

  const handleForceRun = async () => {
    setIsRunning(true);
    toast.loading('Starting Viralis autopilot workflow...', { id: 'workflow' });
    
    try {
      const res = await fetch('/api/trigger', { method: 'POST' });
      const responseData = await res.json();
      
      if (responseData.success) {
        toast.success('Workflow initiated. Check Approval Queue or Content Library!', { id: 'workflow', duration: 5000 });
        fetchData(); 
      } else {
        toast.error('Workflow failed to start. Check OpenAI key in Settings.', { id: 'workflow', duration: 5000 });
      }
    } catch (err) {
      toast.error('Network error triggering workflow.', { id: 'workflow' });
    } finally {
      setIsRunning(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    
    toast.loading('Saving Viralis configuration...', { id: 'settings' });
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          youtubeId: ytId, 
          instagramId: igId, 
          aiProvider,
          aiApiKey: aiApiKey || undefined,
          aiModel: aiModel || undefined,
          youtubeClientId: ytClientId,
          youtubeClientSecret: ytClientSecret,
          instagramAccessToken: igAccessToken,
          brandName,
          brandNiche,
          brandTone,
          targetAudience,
          discordWebhookUrl: discordWebhook,
          pexelsApiKey: pexelsKey,
          elevenLabsApiKey: elevenLabsKey,
          pixabayApiKey: pixabayKey,
          videoStyle,
          captionStyle,
          youtubeDataApiKey: youtubeDataApiKey || undefined,
          defaultPlatforms,
          defaultOrientations,
        })
      });
      const responseData = await res.json();
      if (responseData.success) {
        toast.success("Configuration saved successfully!", { id: 'settings' });
        fetchData();
      } else {
        toast.error("Failed to save settings.", { id: 'settings' });
      }
    } catch (err) {
      toast.error("Error saving settings.", { id: 'settings' });
    }
  };

  const goToTab = (tab: string) => {
    setActiveTab(tab);
    setMobileNavOpen(false);
  };

  const handleYoutubeLogin = () => {
    if (!ytClientId || !ytClientSecret) {
      toast.error("Save your GCP Client ID and Client Secret first!");
      return;
    }
    window.location.href = '/api/auth/youtube';
  };

  if (loading || authStatus === 'loading') {
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
    videos = [], 
    projects = [],
    totalClipsCount = 0,
    stats = { totalGenerated: 0, successCount: 0, views: 0, engagement: 0, subs: 0, revenue: 0 }, 
    settings = {} as SettingsData 
  } = data || {};

  const pendingQueueCount = data?.approvalQueue?.length || 0;

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

          {/* Workspace Switcher */}
          <button type="button" className="btn btn-ghost" style={{ gap: '0.45rem', paddingLeft: '0.4rem', paddingRight: '0.5rem' }}>
            <span style={{ width: '18px', height: '18px', borderRadius: '5px', background: 'var(--surface-3)', border: '1px solid var(--border-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.625rem', fontWeight: 700, color: 'var(--text-2)' }}>A</span>
            <span style={{ fontSize: '0.8125rem', fontWeight: 550, color: 'var(--text)' }}>Acme Media Studio</span>
            <ChevronDown size={13} color="var(--text-3)" />
          </button>
        </div>

        {/* Center Search */}
        <div className="header-search">
          <Search aria-hidden="true" />
          <input
            type="text"
            placeholder="Search or jump to…"
            aria-label="Search projects, clips, or command"
          />
          <kbd>⌘K</kbd>
        </div>

        {/* Right controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="badge badge-neutral" style={{ gap: '0.4rem' }}>
            <span className="pulse-dot" style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} aria-hidden="true"></span>
            Pipeline online
          </span>

          <button type="button" className="icon-btn" aria-label="Notifications">
            <Bell size={16} />
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
                {activeTab === 'autopilot' && "Scan Google Trends and autonomously write, voice, and produce short-form videos."}
                {activeTab === 'queue' && "Review repurposed clips and autonomous scripts before they publish."}
                {activeTab === 'learning-loop' && "Closed-loop audience retention metrics and dynamic highlight re-weighting."}
                {activeTab === 'trends' && "Real-time Google Trends signals and back-catalog matching."}
                {activeTab === 'agents' && "Multi-agent execution across highlight detection, editing, and distribution."}
                {activeTab === 'settings' && "API keys, OAuth connections, and brand voice."}
                {activeTab === 'content' && "Every rendered clip and autopilot video in one catalog."}
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
                  { label: 'Autopilot videos', value: videos.length, icon: Video, foot: 'Fully automated pipeline' },
                  { label: 'Avg. watch-through', value: '74%', icon: TrendingUp, foot: 'Across published clips' },
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
                    Scans trends, writes the script, generates the voiceover, and renders the video — hands-off.
                  </p>
                  <button onClick={() => setActiveTab('learning-loop')} className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start', marginTop: '0.15rem' }}>
                    View Learning Loop <ChevronRight />
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
                          : 94;

                        return (
                          <tr key={p.id}>
                            <td style={{ fontWeight: 600, color: 'var(--foreground)' }}>{p.title}</td>
                            <td>
                              <span className="badge badge-neutral" style={{ textTransform: 'uppercase', fontSize: '0.625rem' }}>
                                {p.sourceType}
                              </span>
                            </td>
                            <td>{p.clips?.length || 0} clips surfaced</td>
                            <td>
                              <span className="badge badge-success" style={{ fontWeight: 700 }}>
                                <Flame size={11} /> {topScore}/100
                              </span>
                            </td>
                            <td>
                              <button onClick={() => setActiveTab('repurpose')} className="btn btn-secondary" style={{ fontSize: '0.6875rem', padding: '0.25rem 0.55rem' }}>
                                Edit Clips
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

              {/* Autopilot Generations Table */}
              <div className="panel">
                <div className="panel-header">
                  <span className="section-title">Recent autopilot videos</span>
                  <button onClick={() => setActiveTab('autopilot')} className="btn btn-ghost btn-sm">
                    View all <ChevronRight />
                  </button>
                </div>

                {videos.length === 0 ? (
                  <div className="panel-empty">
                    <Sparkles style={{ width: 20, height: 20, margin: '0 auto 0.6rem', opacity: 0.5 }} />
                    <p>No autopilot videos yet. Run the autopilot to generate your first short.</p>
                  </div>
                ) : (
                  <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Topic</th>
                        <th>Status</th>
                        <th>Date</th>
                        <th>Engagement</th>
                      </tr>
                    </thead>
                    <tbody>
                      {videos.slice(0, 5).map((v: VideoData) => (
                        <tr key={v.id}>
                          <td style={{ fontWeight: 600 }}>{v.topic}</td>
                          <td>
                            <span className={`badge ${v.status === 'success' ? 'badge-success' : v.status === 'failed' ? 'badge-danger' : 'badge-warning'}`}>
                              {v.status === 'success' ? <CheckCircle2 size={11} /> : v.status === 'failed' ? <XCircle size={11} /> : <Clock size={11} />}
                              {v.status}
                            </span>
                          </td>
                          <td className="text-muted">{new Date(v.createdAt).toLocaleDateString()}</td>
                          <td className="text-subtle" style={{ fontSize: '0.75rem' }}>
                            {v.views || 0} views • {v.likes || 0} likes
                          </td>
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
              onRefresh={fetchData}
              defaultPlatforms={defaultPlatforms}
              defaultOrientations={defaultOrientations}
              defaultCaptionStyle={captionStyle}
            />
          )}

          {/* AUTOPILOT GENERATOR TAB */}
          {activeTab === 'autopilot' && (
            <div className="panel-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--surface-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '0.9375rem', fontWeight: 700 }}>Autopilot Trend Videos</h3>
                  <p className="text-subtle" style={{ fontSize: '0.75rem' }}>AI generated scripts, b-roll footage, and voiceover rendered with FFmpeg.</p>
                </div>
                <span className="badge badge-neutral">{videos.length} Videos</span>
              </div>

              {videos.length === 0 ? (
                <div style={{ padding: '3.5rem', textAlign: 'center' }}>
                  <p className="text-muted" style={{ fontSize: '0.8125rem' }}>No videos in the library yet. Click &quot;Run Autopilot Cycle&quot; to begin.</p>
                </div>
              ) : (
                <div className="grid-cols-3" style={{ padding: '1.25rem' }}>
                  {videos.map((v: VideoData) => (
                    <div key={v.id} className="panel-card panel-card-interactive" style={{ padding: 0, overflow: 'hidden' }}>
                      <div style={{ height: '140px', background: 'radial-gradient(circle at center, #1e1b4b 0%, #09090b 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid var(--surface-border)', position: 'relative' }}>
                        <Video size={32} color="var(--primary)" />
                        <span style={{ position: 'absolute', top: 10, right: 10 }} className={`badge ${v.status === 'success' ? 'badge-success' : 'badge-warning'}`}>
                          {v.status}
                        </span>
                      </div>
                      <div style={{ padding: '0.85rem' }}>
                        <h4 style={{ fontSize: '0.8125rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.topic}</h4>
                        <p className="text-subtle" style={{ fontSize: '0.75rem', marginTop: '0.2rem' }}>
                          {new Date(v.createdAt).toLocaleDateString()} • {v.views || 0} views
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* APPROVAL QUEUE TAB */}
          {activeTab === 'queue' && (
            <ApprovalQueueView items={data?.approvalQueue || []} onRefresh={fetchData} />
          )}

          {/* CONTENT LIBRARY TAB */}
          {activeTab === 'content' && (
            <div className="panel-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--surface-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '0.9375rem', fontWeight: 700 }}>Unified Content Catalog</h3>
                <span className="badge badge-neutral">{videos.length + totalClipsCount} Total Assets</span>
              </div>
              <div style={{ padding: '1.5rem', textAlign: 'center' }}>
                <p className="text-muted" style={{ fontSize: '0.8125rem' }}>
                  All rendered clips and autopilot videos are cataloged in your workspace. Select any asset in the Repurpose Studio to preview or download.
                </p>
              </div>
            </div>
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
                        <input type="password" value={ytClientSecret} onChange={(e) => setYtClientSecret(e.target.value)} placeholder="GOCSPX-..." className="input-field" />
                      </div>
                      <button type="button" className="btn btn-secondary" style={{ fontSize: '0.75rem' }} onClick={handleYoutubeLogin}>
                        Authorize YouTube Account
                      </button>
                    </div>
                  </div>

                  <div className="panel-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <h3 style={{ fontSize: '0.875rem', fontWeight: 700 }}>Instagram Graph API</h3>
                      <span className={`badge ${settings?.instagramAccessToken ? 'badge-success' : 'badge-neutral'}`}>
                        {settings?.instagramAccessToken ? 'Connected' : 'Not Connected'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div className="form-group">
                        <label className="form-label">Instagram Business Account ID</label>
                        <input type="text" value={igId} onChange={(e) => setIgId(e.target.value)} placeholder="178414..." className="input-field" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Page Access Token</label>
                        <input type="password" value={igAccessToken} onChange={(e) => setIgAccessToken(e.target.value)} placeholder="EAA..." className="input-field" />
                      </div>
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
                    <h3 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.75rem' }}>Media Assets & Voice</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div className="form-group">
                        <label className="form-label">ElevenLabs API Key (Hyper-Realistic TTS)</label>
                        <input type="password" value={elevenLabsKey} onChange={(e) => setElevenLabsKey(e.target.value)} placeholder="API Key..." className="input-field" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Pexels API Key (Stock B-Roll)</label>
                        <input type="password" value={pexelsKey} onChange={(e) => setPexelsKey(e.target.value)} placeholder="API Key..." className="input-field" />
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
                    <input type="text" value={discordWebhook} onChange={(e) => setDiscordWebhook(e.target.value)} placeholder="https://discord.com/api/webhooks/..." className="input-field" />
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
