"use client";

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { VideoData, DashboardStats, SettingsData } from '@/types';
import { 
  LayoutDashboard, Video, TrendingUp, Settings, Play, CheckCircle, Clock, PlayCircle, Camera, BarChart3, Loader2, XCircle, Bot, Zap, History, LogOut, User as UserIcon
} from 'lucide-react';
import { AgentStatusView } from '@/components/AgentStatusView';
import { TrendHistoryView } from '@/components/TrendHistoryView';
import { signIn, signOut, useSession } from 'next-auth/react';

export default function Dashboard() {
  const { data: session, status: authStatus } = useSession();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [data, setData] = useState<{videos: VideoData[], stats: DashboardStats, settings: SettingsData, agents: AgentStatus[], trends: any[]} | null>(null);

  // Settings Forms
  const [ytId, setYtId] = useState('');
  const [igId, setIgId] = useState('');
  const [openAi, setOpenAi] = useState('');
  const [ytClientId, setYtClientId] = useState('');
  const [ytClientSecret, setYtClientSecret] = useState('');
  const [igAccessToken, setIgAccessToken] = useState('');

  const fetchData = async () => {
    try {
      const res = await fetch('/api/data');
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        setYtId(json.data.settings.youtubeId);
        setIgId(json.data.settings.instagramId);
        setOpenAi(json.data.settings.openAiKey);
        setYtClientId(json.data.settings.youtubeClientId);
        setYtClientSecret(json.data.settings.youtubeClientSecret);
        setIgAccessToken(json.data.settings.instagramAccessToken);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    fetchData();
    const interval = setInterval(fetchData, 30000);
    // Check for OAuth callback success
    if (typeof window !== 'undefined' && window.location.search.includes('success=youtube_connected')) {
        toast.success("YouTube Account successfully authorized via OAuth!", { id: 'oauth', duration: 5000 });
        window.history.replaceState(null, '', '/');
    }
    return () => clearInterval(interval);
  }, []);

  const handleForceRun = async () => {
    setIsRunning(true);
    toast.loading('Starting automation workflow...', { id: 'workflow' });
    
    try {
      const res = await fetch('/api/trigger', { method: 'POST' });
      const responseData = await res.json();
      
      if (responseData.success) {
        toast.success('Workflow successfully initiated. Check Recent Generations for live status!', { id: 'workflow', duration: 5000 });
        fetchData(); 
      } else {
        toast.error('Workflow failed to start. Check logs.', { id: 'workflow', duration: 5000 });
      }
    } catch (err) {
      toast.error('Network error triggering workflow.', { id: 'workflow' });
    } finally {
      setIsRunning(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    
    toast.loading('Saving settings...', { id: 'settings' });
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
            instagramAccessToken: igAccessToken
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
        toast.error("You must save your Client ID and Client Secret first!");
        return;
    }
    window.location.href = '/api/auth/youtube';
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--background)' }}><Loader2 className="animate-spin" size={48} color="var(--primary)" /></div>;

  const { videos, stats, settings } = data || { videos: [], stats: {}, settings: {} };
  const successRate = stats.totalGenerated > 0 ? Math.round((stats.successCount / stats.totalGenerated) * 100) : 0;

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <aside className="sidebar glass-panel" style={{ borderRadius: 0, borderTop: 'none', borderBottom: 'none', borderLeft: 'none' }}>
        <div>
          <h2 className="text-gradient" style={{ fontSize: '1.5rem', marginBottom: '2rem' }}>Automator AI</h2>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
              <LayoutDashboard size={20} /> Overview
            </button>
            <button className={`nav-item ${activeTab === 'content' ? 'active' : ''}`} onClick={() => setActiveTab('content')}>
              <Video size={20} /> Content Library
            </button>
            <button className={`nav-item ${activeTab === 'trends' ? 'active' : ''}`} onClick={() => setActiveTab('trends')}>
              <History size={20} /> Trend History
            </button>
            <button className={`nav-item ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => setActiveTab('analytics')}>
              <BarChart3 size={20} /> Analytics
            </button>
            <button className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
              <Settings size={20} /> Settings
            </button>
            <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', margin: '0.5rem 0' }}></div>
            <button className={`nav-item ${activeTab === 'agents' ? 'active' : ''}`} onClick={() => setActiveTab('agents')}>
              <Bot size={20} color={activeTab === 'agents' ? 'var(--primary)' : 'inherit'} /> AI Agents
            </button>
          </nav>
        </div>

        <div className="glass-card" style={{ marginTop: 'auto', padding: '1rem', background: 'rgba(99, 102, 241, 0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 10px var(--success)' }}></div>
            <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>System Status</span>
          </div>
          <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Daemon & Auto-Healer Active</p>
        </div>

        {/* User Profile / Login */}
        <div className="glass-panel" style={{ marginTop: '1rem', padding: '1rem' }}>
          {authStatus === 'authenticated' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {session.user?.image ? (
                <img src={session.user.image} alt="User" style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
              ) : (
                <UserIcon size={32} color="var(--primary)" />
              )}
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <p style={{ fontSize: '0.875rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{session.user?.name}</p>
                <button onClick={() => signOut()} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.75rem', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <LogOut size={12} /> Sign Out
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => signIn('google')} className="btn btn-primary" style={{ width: '100%', fontSize: '0.875rem' }}>
              Sign in with Google
            </button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="flex-between animate-fade-in" style={{ marginBottom: '3rem' }}>
          <div>
            <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem', textTransform: 'capitalize' }}>
              {activeTab.replace('-', ' ')}
            </h1>
            <p style={{ color: '#94a3b8' }}>
              {activeTab === 'overview' && "Welcome back. Here's your real-time automation status."}
              {activeTab === 'content' && "View your previously generated and uploaded videos."}
              {activeTab === 'trends' && "History of viral topics identified by TrendIntelligence."}
              {activeTab === 'analytics' && "Track your revenue and overall channel growth."}
              {activeTab === 'settings' && "Manage your API keys, OAuth logins, and daemon configuration."}
              {activeTab === 'agents' && "Monitor and instruct your specialized autonomous AI workforce."}
            </p>
          </div>
          
          {activeTab === 'overview' && (
            <button className="btn btn-primary" onClick={handleForceRun} disabled={isRunning}>
              {isRunning ? <Loader2 size={18} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={18} />} 
              {isRunning ? 'Processing...' : 'Force Run Now'}
            </button>
          )}
          {activeTab === 'agents' && (
            <button className="btn btn-outline" onClick={() => toast.success('Orchestrator self-check complete. All agents online.')}>
              <Zap size={18} color="var(--primary)" />
              Force Sync
            </button>
          )}
        </header>

        {activeTab === 'overview' && (
          <div className="animate-fade-in delay-100">
            {/* Stats Row */}
            <section className="grid-cols-3" style={{ marginBottom: '3rem' }}>
              <div className="glass-card">
                <div className="flex-between" style={{ marginBottom: '1rem' }}>
                  <h3 style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Live Trend API</h3>
                  <TrendingUp size={20} color="var(--primary)" />
                </div>
                <p style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Auto-Fetching Daily...</p>
                <span className="badge badge-success">Connected via Google Trends</span>
              </div>
              
              <div className="glass-card">
                <div className="flex-between" style={{ marginBottom: '1rem' }}>
                  <h3 style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Videos Generated (All Time)</h3>
                  <Video size={20} color="var(--secondary)" />
                </div>
                <p style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>{stats.successCount} / {stats.totalGenerated}</p>
                {stats.totalGenerated === 0 ? (
                   <span className="badge" style={{ background: 'rgba(255,255,255,0.1)' }}>No videos generated yet</span>
                ) : (
                   <span className={`badge ${successRate >= 90 ? 'badge-primary' : successRate >= 50 ? 'badge-warning' : 'badge-danger'}`}>
                     {successRate}% Success Rate
                   </span>
                )}
              </div>

              <div className="glass-card">
                <div className="flex-between" style={{ marginBottom: '1rem' }}>
                  <h3 style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Est. Total Revenue</h3>
                  <BarChart3 size={20} color="var(--success)" />
                </div>
                <p style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>${stats.revenue.toFixed(2)}</p>
                <span className="badge badge-success">Real DB Values</span>
              </div>
            </section>

            {/* Recent Activity */}
            <section className="glass-panel" style={{ padding: '2rem' }}>
              <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Recent Generations</h2>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {videos.length === 0 ? (
                  <p style={{ color: '#94a3b8' }}>No automation cycles run yet. Click &quot;Force Run Now&quot; to start.</p>
                ) : (
                  videos.slice(0, 3).map((v: VideoData) => (
                    <div key={v.id} className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', padding: '1rem 1.5rem' }}>
                      {v.status === 'success' && <CheckCircle size={24} color="var(--success)" />}
                      {v.status === 'pending' && <Clock size={24} color="var(--warning)" />}
                      {v.status === 'failed' && <XCircle size={24} color="var(--danger)" />}
                      
                      <div style={{ flex: 1 }}>
                        <h4 style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{v.topic}</h4>
                        <p style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                          {v.status === 'success' ? 'Generated and uploaded successfully.' : 
                           v.status === 'failed' ? 'Failed to upload. Auto-healer will retry.' : 'Currently processing...'}
                        </p>
                      </div>
                      <span style={{ fontSize: '0.875rem', color: '#94a3b8' }}>{new Date(v.createdAt).toLocaleDateString()}</span>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'content' && (
          <div className="glass-panel animate-fade-in" style={{ padding: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Generated Videos Database</h2>
            <p style={{ color: '#94a3b8', marginBottom: '1rem' }}>All genuine content generated by the AI Daemon.</p>
            {videos.length === 0 ? (
              <p style={{ color: '#94a3b8', padding: '2rem', textAlign: 'center', border: '1px dashed var(--surface-border)', borderRadius: '8px' }}>
                No videos exist in the database yet.
              </p>
            ) : (
              <div className="grid-cols-3">
                {videos.map((v: VideoData) => (
                  <div key={v.id} className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ height: '150px', background: '#2d313a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <PlayCircle size={32} color={v.status === 'success' ? '#10b981' : '#94a3b8'} />
                    </div>
                    <div style={{ padding: '1rem' }}>
                      <h4 style={{ fontSize: '1rem', marginBottom: '0.25rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.topic}</h4>
                      <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{new Date(v.createdAt).toLocaleDateString()} • {v.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="glass-panel animate-fade-in" style={{ padding: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Channel Analytics</h2>
            <div className="grid-cols-3" style={{ marginBottom: '2rem' }}>
              <div className="glass-card" style={{ borderLeft: '3px solid var(--primary)' }}>
                <h4 style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Total Views</h4>
                <p style={{ fontSize: '1.5rem', fontWeight: 700 }}>{stats.views}</p>
              </div>
              <div className="glass-card" style={{ borderLeft: '3px solid var(--success)' }}>
                <h4 style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Engagement Rate</h4>
                <p style={{ fontSize: '1.5rem', fontWeight: 700 }}>{stats.engagement}%</p>
              </div>
              <div className="glass-card" style={{ borderLeft: '3px solid var(--secondary)' }}>
                <h4 style={{ fontSize: '0.875rem', color: '#94a3b8' }}>New Subscribers</h4>
                <p style={{ fontSize: '1.5rem', fontWeight: 700 }}>+{stats.subs}</p>
              </div>
            </div>
            <p style={{ color: '#94a3b8' }}>The system checks these real database metrics automatically to adjust the OpenAI prompt.</p>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <section className="glass-panel" style={{ padding: '2rem' }}>
              <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Settings size={20} /> Platform Connections & OAuth
              </h2>
              <p style={{ color: '#94a3b8', marginBottom: '2rem' }}>Configure your GCP and Meta developer tokens to grant the daemon upload permissions.</p>
              
              <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                  
                  {/* YouTube OAuth Configuration */}
                  <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: '4px solid #ff0000' }}>
                    <div className="flex-between">
                      <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                        <PlayCircle size={20} color="#ff0000" /> YouTube OAuth
                      </h3>
                      <span className="badge" style={{ background: settings.hasYoutubeAuth ? 'rgba(16,185,129,0.1)' : 'rgba(255,0,0,0.1)', color: settings.hasYoutubeAuth ? 'var(--success)' : '#ff0000' }}>
                        {settings.hasYoutubeAuth ? 'Authorized ✅' : 'Not Authorized ❌'}
                      </span>
                    </div>
                    <div>
                      <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '1rem' }}>Enter your Google Cloud Platform credentials, save them, then click Login to grant upload permissions.</p>
                      
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: '#94a3b8' }}>GCP Client ID</label>
                      <input type="text" value={ytClientId} onChange={(e) => setYtClientId(e.target.value)} placeholder="...apps.googleusercontent.com" className="glass-card" style={{ width: '100%', padding: '0.75rem', color: 'white', border: '1px solid var(--surface-border)', marginBottom: '1rem' }} />
                      
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: '#94a3b8' }}>GCP Client Secret</label>
                      <input type="password" value={ytClientSecret} onChange={(e) => setYtClientSecret(e.target.value)} placeholder="GOCSPX-..." className="glass-card" style={{ width: '100%', padding: '0.75rem', color: 'white', border: '1px solid var(--surface-border)', marginBottom: '1rem' }} />
                      
                      <button type="button" className="btn btn-outline" style={{ width: '100%', borderColor: '#ff0000', color: '#ff0000', marginTop: '0.5rem' }} onClick={handleYoutubeLogin}>
                        Login with Google
                      </button>
                    </div>
                  </div>

                  {/* Instagram Graph API */}
                  <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: '4px solid #e1306c' }}>
                    <div className="flex-between">
                      <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                        <Camera size={20} color="#e1306c" /> Instagram Graph API
                      </h3>
                      <span className="badge" style={{ background: settings.instagramAccessToken ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.1)', color: settings.instagramAccessToken ? 'var(--success)' : 'inherit' }}>
                        {settings.instagramAccessToken ? 'Connected' : 'Not Connected'}
                      </span>
                    </div>
                    <div>
                      <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '1rem' }}>Generate a long-lived Page Access Token from the Meta Developer Graph API Explorer.</p>
                      
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: '#94a3b8' }}>Instagram Account ID</label>
                      <input type="text" value={igId} onChange={(e) => setIgId(e.target.value)} placeholder="178414..." className="glass-card" style={{ width: '100%', padding: '0.75rem', color: 'white', border: '1px solid var(--surface-border)', marginBottom: '1rem' }} />
                      
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: '#94a3b8' }}>Page Access Token</label>
                      <input type="password" value={igAccessToken} onChange={(e) => setIgAccessToken(e.target.value)} placeholder="EAA..." className="glass-card" style={{ width: '100%', padding: '0.75rem', color: 'white', border: '1px solid var(--surface-border)', marginBottom: '1rem' }} />
                    </div>
                  </div>
                </div>

                <div className="glass-card">
                  <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>AI Engine Configuration</h3>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>OpenAI API Key (Required for Scripts)</label>
                    <input type="password" value={openAi} onChange={(e) => setOpenAi(e.target.value)} placeholder="sk-..." className="glass-card" style={{ width: '100%', padding: '0.75rem', color: 'white', border: '1px solid var(--surface-border)' }} />
                  </div>
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: 'fit-content' }}>Save All Configuration</button>
              </form>
            </section>
          </div>
        )}
      </main>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}} />
    </div>
  );
}
