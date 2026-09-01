"use client";

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { VideoData, DashboardStats, SettingsData, AgentStatus } from '@/types';
import { 
  LayoutDashboard, Video, TrendingUp, Settings, Play, CheckCircle2, Clock, XCircle, Bot, Zap, History, LogOut, User as UserIcon, ClipboardCheck, Bell, Briefcase, RefreshCw, BarChart2, Shield, Eye, ThumbsUp, ChevronRight
} from 'lucide-react';
import { AgentStatusView } from '@/components/AgentStatusView';
import { TrendHistoryView } from '@/components/TrendHistoryView';
import { ApprovalQueueView } from '@/components/ApprovalQueueView';
import { signIn, signOut, useSession } from 'next-auth/react';

export default function Dashboard() {
  const { data: session, status: authStatus } = useSession();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [data, setData] = useState<{videos: VideoData[], stats: DashboardStats, settings: SettingsData, agents: AgentStatus[], trends: any[], approvalQueue: any[]} | null>(null);

  // Settings State
  const [ytId, setYtId] = useState('');
  const [igId, setIgId] = useState('');
  const [openAi, setOpenAi] = useState('');
  const [ytClientId, setYtClientId] = useState('');
  const [ytClientSecret, setYtClientSecret] = useState('');
  const [igAccessToken, setIgAccessToken] = useState('');
  
  // Brand Settings
  const [brandName, setBrandName] = useState('');
  const [brandNiche, setBrandNiche] = useState('');
  const [brandTone, setBrandTone] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [discordWebhook, setDiscordWebhook] = useState('');
  const [pexelsKey, setPexelsKey] = useState('');
  
  // Pro Video Settings
  const [elevenLabsKey, setElevenLabsKey] = useState('');
  const [pixabayKey, setPixabayKey] = useState('');
  const [videoStyle, setVideoStyle] = useState('Cinematic Stock');
  const [captionStyle, setCaptionStyle] = useState('Dynamic Pop');

  const fetchData = async () => {
    try {
      const res = await fetch('/api/data');
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        if (json.data.settings) {
          setYtId(json.data.settings.youtubeId || '');
          setIgId(json.data.settings.instagramId || '');
          setOpenAi(json.data.settings.openAiKey || '');
          setYtClientId(json.data.settings.youtubeClientId || '');
          setYtClientSecret(json.data.settings.youtubeClientSecret || '');
          setIgAccessToken(json.data.settings.instagramAccessToken || '');
          setBrandName(json.data.settings.brandName || '');
          setBrandNiche(json.data.settings.brandNiche || '');
          setBrandTone(json.data.settings.brandTone || '');
          setTargetAudience(json.data.settings.targetAudience || '');
          setDiscordWebhook(json.data.settings.discordWebhookUrl || '');
          setPexelsKey(json.data.settings.pexelsApiKey || '');
          setElevenLabsKey(json.data.settings.elevenLabsApiKey || '');
          setPixabayKey(json.data.settings.pixabayApiKey || '');
          setVideoStyle(json.data.settings.videoStyle || 'Cinematic Stock');
          setCaptionStyle(json.data.settings.captionStyle || 'Dynamic Pop');
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    if (typeof window !== 'undefined' && window.location.search.includes('success=youtube_connected')) {
        toast.success("YouTube Account authorized successfully!", { id: 'oauth', duration: 5000 });
        window.history.replaceState(null, '', '/');
    }
    return () => clearInterval(interval);
  }, []);

  const handleForceRun = async () => {
    setIsRunning(true);
    toast.loading('Starting automated workflow...', { id: 'workflow' });
    
    try {
      const res = await fetch('/api/trigger', { method: 'POST' });
      const responseData = await res.json();
      
      if (responseData.success) {
        toast.success('Workflow initiated. Check Approval Queue or Recent Activity!', { id: 'workflow', duration: 5000 });
        fetchData(); 
      } else {
        toast.error('Workflow failed to start. Check OpenAI key.', { id: 'workflow', duration: 5000 });
      }
    } catch (err) {
      toast.error('Network error triggering workflow.', { id: 'workflow' });
    } finally {
      setIsRunning(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    
    toast.loading('Saving configuration...', { id: 'settings' });
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            youtubeId: ytId, 
            instagramId: igId, 
            openAiKey: openAi,
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
            captionStyle
        })
      });
      const responseData = await res.json();
      if (responseData.success) {
        toast.success("Settings saved successfully!", { id: 'settings' });
        fetchData();
      } else {
        toast.error("Failed to save settings.", { id: 'settings' });
      }
    } catch (err) {
      toast.error("Error saving settings.", { id: 'settings' });
    }
  };

  const handleYoutubeLogin = () => {
    if (!ytClientId || !ytClientSecret) {
        toast.error("Save your GCP Client ID and Client Secret first!");
        return;
    }
    window.location.href = '/api/auth/youtube';
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--background)', gap: '0.85rem' }}>
        <RefreshCw className="animate-spin" size={32} color="var(--primary)" />
        <p className="text-muted" style={{ fontSize: '0.875rem' }}>Loading Dashboard...</p>
      </div>
    );
  }

  const { videos = [], stats = { totalGenerated: 0, successCount: 0, views: 0, engagement: 0, subs: 0, revenue: 0 }, settings = {} as SettingsData } = data || {};
  const totalGen = stats?.totalGenerated || 0;
  const succCount = stats?.successCount || 0;
  const rev = stats?.revenue || 0;
  const successRate = totalGen > 0 ? Math.round((succCount / totalGen) * 100) : 0;
  const pendingQueueCount = data?.approvalQueue?.length || 0;

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar-nav">
        <div>
          {/* Brand Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '2rem', padding: '0 0.4rem' }}>
            <div style={{ padding: '0.45rem', borderRadius: 'var(--radius-sm)', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={18} color="#ffffff" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--foreground)', lineHeight: 1.2 }}>Automator AI</h2>
              <span className="text-subtle" style={{ fontSize: '0.7rem', fontWeight: 500 }}>Social Engine v2.4</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <button className={`nav-link ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
              <LayoutDashboard size={17} /> Overview
            </button>
            <button className={`nav-link ${activeTab === 'content' ? 'active' : ''}`} onClick={() => setActiveTab('content')}>
              <Video size={17} /> Content Library
            </button>
            <button className={`nav-link ${activeTab === 'queue' ? 'active' : ''}`} onClick={() => setActiveTab('queue')}>
              <ClipboardCheck size={17} /> Approval Queue
              {pendingQueueCount > 0 && (
                <span className="badge badge-primary" style={{ marginLeft: 'auto', fontSize: '0.65rem', padding: '0.1rem 0.45rem' }}>
                  {pendingQueueCount}
                </span>
              )}
            </button>
            <button className={`nav-link ${activeTab === 'trends' ? 'active' : ''}`} onClick={() => setActiveTab('trends')}>
              <History size={17} /> Trend History
            </button>
            <button className={`nav-link ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => setActiveTab('analytics')}>
              <BarChart2 size={17} /> Analytics
            </button>
            <button className={`nav-link ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
              <Settings size={17} /> Settings
            </button>
            <button className={`nav-link ${activeTab === 'agents' ? 'active' : ''}`} onClick={() => setActiveTab('agents')}>
              <Bot size={17} /> AI Agents
            </button>
          </nav>
        </div>

        {/* Sidebar Footer Status & User */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div className="panel-card" style={{ padding: '0.75rem 0.9rem', background: 'var(--surface-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }}></span>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--foreground)' }}>Daemon Active</span>
            </div>
            <p className="text-subtle" style={{ fontSize: '0.725rem' }}>Auto-Healer Running</p>
          </div>

          <div style={{ borderTop: '1px solid var(--surface-border)', paddingTop: '0.75rem' }}>
            {authStatus === 'authenticated' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                {session?.user?.image ? (
                  <img src={session.user.image} alt="User" style={{ width: '28px', height: '28px', borderRadius: '50%' }} />
                ) : (
                  <UserIcon size={20} color="var(--foreground-muted)" />
                )}
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--foreground)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{session?.user?.name}</p>
                  <button onClick={() => signOut()} style={{ background: 'none', border: 'none', color: 'var(--foreground-subtle)', fontSize: '0.7rem', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                    <LogOut size={11} /> Sign Out
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => signIn('google')} className="btn btn-secondary" style={{ width: '100%', fontSize: '0.8rem', padding: '0.5rem' }}>
                Sign in with Google
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Viewport */}
      <main className="main-viewport">
        {/* Top Action Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.6rem', textTransform: 'capitalize', fontWeight: 700 }}>
              {activeTab.replace('-', ' ')}
            </h1>
            <p className="text-muted" style={{ fontSize: '0.875rem', marginTop: '0.2rem' }}>
              {activeTab === 'overview' && "Real-time performance metrics and workflow trigger status."}
              {activeTab === 'content' && "Library of AI generated video clips and social distribution stats."}
              {activeTab === 'queue' && "Human review workflow for generated scripts and visual scenes."}
              {activeTab === 'trends' && "Historical trend logs discovered by the TrendIntelligence agent."}
              {activeTab === 'analytics' && "Cross-platform view rates, engagement, and revenue analytics."}
              {activeTab === 'settings' && "API connection keys, OAuth tokens, and brand identity parameters."}
              {activeTab === 'agents' && "Monitor multi-agent execution states and dispatch instructions."}
            </p>
          </div>

          {activeTab === 'overview' && (
            <button className="btn btn-primary" onClick={handleForceRun} disabled={isRunning}>
              {isRunning ? <RefreshCw size={15} className="animate-spin" /> : <Play size={15} />}
              {isRunning ? 'Processing...' : 'Run Workflow'}
            </button>
          )}
        </div>

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
            {/* Metric Cards Row */}
            <div className="grid-metrics">
              <div className="panel-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span className="text-muted" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Trend Radar</span>
                  <TrendingUp size={16} color="var(--primary)" />
                </div>
                <p style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--foreground)' }}>Google Trends API</p>
                <span className="badge badge-success">Connected</span>
              </div>

              <div className="panel-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span className="text-muted" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Videos Generated</span>
                  <Video size={16} color="var(--accent-blue)" />
                </div>
                <p style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '0.35rem', color: 'var(--foreground)' }}>
                  {succCount} <span style={{ fontSize: '0.9rem', color: 'var(--foreground-subtle)', fontWeight: 500 }}>/ {totalGen}</span>
                </p>
                <span className={`badge ${successRate >= 80 ? 'badge-success' : 'badge-neutral'}`}>
                  {successRate}% Success Rate
                </span>
              </div>

              <div className="panel-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span className="text-muted" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Est. Revenue</span>
                  <BarChart2 size={16} color="var(--accent-emerald)" />
                </div>
                <p style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '0.35rem', color: 'var(--foreground)' }}>
                  ${rev.toFixed(2)}
                </p>
                <span className="badge badge-success">Live Metric</span>
              </div>
            </div>

            {/* Recent Generations Data Table */}
            <div className="panel-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--surface-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Recent Generations</h3>
                <button onClick={() => setActiveTab('content')} className="btn btn-ghost" style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}>
                  View All Library <ChevronRight size={14} />
                </button>
              </div>

              {videos.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center' }}>
                  <p className="text-muted" style={{ fontSize: '0.875rem' }}>No automation cycles run yet. Click &quot;Run Workflow&quot; to initiate.</p>
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Topic</th>
                      <th>Status</th>
                      <th>Date</th>
                      <th>Metrics</th>
                    </tr>
                  </thead>
                  <tbody>
                    {videos.slice(0, 5).map((v: VideoData) => (
                      <tr key={v.id}>
                        <td style={{ fontWeight: 600 }}>{v.topic}</td>
                        <td>
                          <span className={`badge ${v.status === 'success' ? 'badge-success' : v.status === 'failed' ? 'badge-danger' : 'badge-warning'}`}>
                            {v.status === 'success' ? <CheckCircle2 size={12} /> : v.status === 'failed' ? <XCircle size={12} /> : <Clock size={12} />}
                            {v.status}
                          </span>
                        </td>
                        <td className="text-muted">{new Date(v.createdAt).toLocaleDateString()}</td>
                        <td className="text-subtle" style={{ fontSize: '0.8rem' }}>
                          {v.views || 0} views • {v.likes || 0} likes
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* CONTENT LIBRARY TAB */}
        {activeTab === 'content' && (
          <div className="panel-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--surface-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Generated Videos Library</h3>
                <p className="text-subtle" style={{ fontSize: '0.8rem' }}>Database catalog of all rendered clips.</p>
              </div>
              <span className="badge badge-neutral">{videos.length} Videos</span>
            </div>

            {videos.length === 0 ? (
              <div style={{ padding: '3.5rem', textAlign: 'center' }}>
                <p className="text-muted" style={{ fontSize: '0.875rem' }}>No videos in the library yet.</p>
              </div>
            ) : (
              <div className="grid-cols-3" style={{ padding: '1.5rem' }}>
                {videos.map((v: VideoData) => (
                  <div key={v.id} className="panel-card panel-card-interactive" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ height: '150px', background: 'var(--surface-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid var(--surface-border)', position: 'relative' }}>
                      <Video size={36} color="var(--foreground-subtle)" />
                      <span style={{ position: 'absolute', top: 10, right: 10 }} className={`badge ${v.status === 'success' ? 'badge-success' : 'badge-warning'}`}>
                        {v.status}
                      </span>
                    </div>
                    <div style={{ padding: '1rem' }}>
                      <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.35rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.topic}</h4>
                      <p className="text-subtle" style={{ fontSize: '0.775rem' }}>
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

        {/* TREND HISTORY TAB */}
        {activeTab === 'trends' && (
          <TrendHistoryView trends={data?.trends || []} />
        )}

        {/* ANALYTICS TAB */}
        {activeTab === 'analytics' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="grid-metrics">
              <div className="panel-card">
                <span className="text-muted" style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>Total Channel Views</span>
                <p style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--foreground)' }}>{(stats?.views || 0).toLocaleString()}</p>
              </div>
              <div className="panel-card">
                <span className="text-muted" style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>Average Engagement Rate</span>
                <p style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--foreground)' }}>{stats?.engagement || 0}%</p>
              </div>
              <div className="panel-card">
                <span className="text-muted" style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>Subscriber Growth</span>
                <p style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--foreground)' }}>+{(stats?.subs || 0).toLocaleString()}</p>
              </div>
            </div>

            <div className="panel-card">
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.35rem' }}>Autonomous Prompt Optimization</h3>
              <p className="text-muted" style={{ fontSize: '0.85rem', lineHeight: '1.6' }}>
                Channel metrics are queried automatically by the Analytics Agent. View-through rates and retention scores feed directly into future OpenAI prompt generation.
              </p>
            </div>
          </div>
        )}

        {/* AI AGENTS TAB */}
        {activeTab === 'agents' && (
          <AgentStatusView agents={data?.agents || []} />
        )}

        {/* SETTINGS TAB */}
        {activeTab === 'settings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* OpenAI Section */}
              <div className="panel-card">
                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>OpenAI Key & Engine</h3>
                <div className="form-group">
                  <label className="form-label">OpenAI API Key (Required for AI Agents & Scriptwriting)</label>
                  <input type="password" value={openAi} onChange={(e) => setOpenAi(e.target.value)} placeholder="sk-..." className="input-field" />
                </div>
              </div>

              {/* Platform Connections */}
              <div className="grid-cols-2">
                {/* YouTube OAuth */}
                <div className="panel-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>YouTube OAuth Connection</h3>
                    <span className={`badge ${settings?.hasYoutubeAuth ? 'badge-success' : 'badge-neutral'}`}>
                      {settings?.hasYoutubeAuth ? 'Authorized' : 'Not Connected'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    <div className="form-group">
                      <label className="form-label">GCP Client ID</label>
                      <input type="text" value={ytClientId} onChange={(e) => setYtClientId(e.target.value)} placeholder="...apps.googleusercontent.com" className="input-field" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">GCP Client Secret</label>
                      <input type="password" value={ytClientSecret} onChange={(e) => setYtClientSecret(e.target.value)} placeholder="GOCSPX-..." className="input-field" />
                    </div>
                    <button type="button" className="btn btn-secondary" style={{ marginTop: '0.25rem' }} onClick={handleYoutubeLogin}>
                      Authorize YouTube Account
                    </button>
                  </div>
                </div>

                {/* Instagram Graph API */}
                <div className="panel-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Instagram Graph API</h3>
                    <span className={`badge ${settings?.instagramAccessToken ? 'badge-success' : 'badge-neutral'}`}>
                      {settings?.instagramAccessToken ? 'Connected' : 'Not Connected'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
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
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem' }}>Brand Identity</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    <div className="form-group">
                      <label className="form-label">Brand Name</label>
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
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem' }}>Media Assets & Voice</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
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
                      <label className="form-label">Subtitle Style</label>
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
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.75rem' }}>Notifications</h3>
                <div className="form-group">
                  <label className="form-label">Discord Webhook URL (Alerts on Content Generation)</label>
                  <input type="text" value={discordWebhook} onChange={(e) => setDiscordWebhook(e.target.value)} placeholder="https://discord.com/api/webhooks/..." className="input-field" />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem 2rem' }}>
                  Save All Configuration
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
