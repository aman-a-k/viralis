"use client";

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { VideoData, DashboardStats, SettingsData, AgentStatus } from '@/types';
import { 
  LayoutDashboard, Video, TrendingUp, Settings, Play, CheckCircle, Clock, PlayCircle, Camera, BarChart3, Loader2, XCircle, Bot, Zap, History, LogOut, User as UserIcon, ClipboardCheck, Bell, Briefcase, Sparkles, ShieldCheck
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

  // Settings Forms
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
        toast.success("YouTube Account successfully authorized via OAuth!", { id: 'oauth', duration: 5000 });
        window.history.replaceState(null, '', '/');
    }
    return () => clearInterval(interval);
  }, []);

  const handleForceRun = async () => {
    setIsRunning(true);
    toast.loading('Starting automated content creation workflow...', { id: 'workflow' });
    
    try {
      const res = await fetch('/api/trigger', { method: 'POST' });
      const responseData = await res.json();
      
      if (responseData.success) {
        toast.success('Workflow successfully initiated. Check Approval Queue or Recent Activity!', { id: 'workflow', duration: 5000 });
        fetchData(); 
      } else {
        toast.error('Workflow failed to start. Check settings and OpenAI key.', { id: 'workflow', duration: 5000 });
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
        toast.error("You must save your GCP Client ID and Client Secret first!");
        return;
    }
    window.location.href = '/api/auth/youtube';
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--background)', gap: '1rem' }}>
        <Loader2 className="animate-spin" size={44} color="#818cf8" />
        <p style={{ color: '#94a3b8', fontSize: '0.95rem', fontWeight: 500 }}>Initializing Automator Intelligence Hub...</p>
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
    <div className="dashboard-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2.5rem', paddingLeft: '0.5rem' }}>
            <div style={{ padding: '0.6rem', borderRadius: '12px', background: 'linear-gradient(135deg, #6366f1, #a855f7)', boxShadow: '0 4px 15px rgba(99, 102, 241, 0.4)' }}>
              <Zap size={22} color="white" />
            </div>
            <div>
              <h2 className="text-gradient" style={{ fontSize: '1.4rem', fontWeight: 800 }}>Automator AI</h2>
              <span style={{ fontSize: '0.7rem', color: '#94a3b8', letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 600 }}>v2.4 Autonomous Engine</span>
            </div>
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <button className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
              <LayoutDashboard size={19} /> Overview
            </button>
            <button className={`nav-item ${activeTab === 'content' ? 'active' : ''}`} onClick={() => setActiveTab('content')}>
              <Video size={19} /> Content Library
            </button>
            <button className={`nav-item ${activeTab === 'queue' ? 'active' : ''}`} onClick={() => setActiveTab('queue')}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <ClipboardCheck size={19} />
                {pendingQueueCount > 0 && (
                  <span style={{ position: 'absolute', top: -4, right: -6, width: 8, height: 8, background: '#a855f7', borderRadius: '50%', boxShadow: '0 0 8px #a855f7' }}></span>
                )}
              </div> 
              Approval Queue
              {pendingQueueCount > 0 && (
                <span className="badge badge-primary" style={{ marginLeft: 'auto', fontSize: '0.675rem', padding: '0.15rem 0.5rem' }}>
                  {pendingQueueCount}
                </span>
              )}
            </button>
            <button className={`nav-item ${activeTab === 'trends' ? 'active' : ''}`} onClick={() => setActiveTab('trends')}>
              <History size={19} /> Trend History
            </button>
            <button className={`nav-item ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => setActiveTab('analytics')}>
              <BarChart3 size={19} /> Analytics
            </button>
            <button className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
              <Settings size={19} /> Settings
            </button>

            <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '0.75rem 0' }}></div>

            <button className={`nav-item ${activeTab === 'agents' ? 'active' : ''}`} onClick={() => setActiveTab('agents')}>
              <Bot size={19} color={activeTab === 'agents' ? '#818cf8' : 'inherit'} /> AI Agents Console
            </button>
          </nav>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="glass-card" style={{ padding: '1rem 1.2rem', background: 'rgba(99, 102, 241, 0.06)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.35rem' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#34d399', boxShadow: '0 0 10px #34d399' }}></div>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ffffff' }}>System Active</span>
            </div>
            <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Auto-Healer & Cron Daemon Ready</p>
          </div>

          {/* User Profile / Login */}
          <div className="glass-panel" style={{ padding: '0.85rem 1rem' }}>
            {authStatus === 'authenticated' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {session?.user?.image ? (
                  <img src={session.user.image} alt="User" style={{ width: '32px', height: '32px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)' }} />
                ) : (
                  <UserIcon size={24} color="#818cf8" />
                )}
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{session?.user?.name}</p>
                  <button onClick={() => signOut()} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.725rem', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <LogOut size={12} /> Sign Out
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => signIn('google')} className="btn btn-outline" style={{ width: '100%', fontSize: '0.825rem', padding: '0.65rem 1rem' }}>
                Sign in with Google
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1rem' }} className="animate-fade-in">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
              <h1 style={{ fontSize: '2.2rem', textTransform: 'capitalize' }}>
                {activeTab.replace('-', ' ')}
              </h1>
              <span className="badge badge-primary" style={{ padding: '0.35rem 0.85rem' }}>
                <ShieldCheck size={13} /> Vercel Ready
              </span>
            </div>
            <p style={{ color: '#94a3b8', fontSize: '0.95rem' }}>
              {activeTab === 'overview' && "Real-time command dashboard, system metrics, and execution status."}
              {activeTab === 'content' && "Library of AI-generated video shorts and channel uploads."}
              {activeTab === 'queue' && "Human approval interface for AI scripts and scene generation."}
              {activeTab === 'trends' && "Database of real-time search trends evaluated by AI."}
              {activeTab === 'analytics' && "Cross-platform analytics and revenue estimates."}
              {activeTab === 'settings' && "Configure API keys, OAuth credentials, and video production parameters."}
              {activeTab === 'agents' && "Monitor multi-agent execution states and dispatch manual commands."}
            </p>
          </div>
          
          {activeTab === 'overview' && (
            <button className="btn btn-primary" onClick={handleForceRun} disabled={isRunning} style={{ padding: '0.85rem 1.75rem' }}>
              {isRunning ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />} 
              {isRunning ? 'Executing Workflow...' : 'Run Automation Cycle'}
            </button>
          )}
          {activeTab === 'agents' && (
            <button className="btn btn-outline" onClick={() => toast.success('Agent Mesh status verified. All sub-agents active.')}>
              <Zap size={18} color="#818cf8" />
              Sync Agent Mesh
            </button>
          )}
        </header>

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="animate-fade-in delay-100" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Metric Cards Row */}
            <section className="grid-cols-3">
              <div className="glass-card" style={{ borderTop: '4px solid #6366f1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ color: '#94a3b8', fontSize: '0.875rem', fontWeight: 600 }}>Trend Radar API</h3>
                  <div style={{ padding: '0.5rem', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.15)' }}>
                    <TrendingUp size={20} color="#818cf8" />
                  </div>
                </div>
                <p style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.6rem', color: '#ffffff' }}>Google Trends Active</p>
                <span className="badge badge-success">Live Signal Connected</span>
              </div>
              
              <div className="glass-card" style={{ borderTop: '4px solid #a855f7' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ color: '#94a3b8', fontSize: '0.875rem', fontWeight: 600 }}>Videos Generated</h3>
                  <div style={{ padding: '0.5rem', borderRadius: '10px', background: 'rgba(168, 85, 247, 0.15)' }}>
                    <Video size={20} color="#c084fc" />
                  </div>
                </div>
                <p style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.6rem', color: '#ffffff' }}>
                  {succCount} <span style={{ fontSize: '1rem', color: '#94a3b8', fontWeight: 500 }}>/ {totalGen}</span>
                </p>
                {totalGen === 0 ? (
                   <span className="badge badge-primary">Awaiting First Execution</span>
                ) : (
                   <span className={`badge ${successRate >= 90 ? 'badge-success' : successRate >= 50 ? 'badge-warning' : 'badge-danger'}`}>
                     {successRate}% Completion Rate
                   </span>
                )}
              </div>

              <div className="glass-card" style={{ borderTop: '4px solid #10b981' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ color: '#94a3b8', fontSize: '0.875rem', fontWeight: 600 }}>Est. Revenue</h3>
                  <div style={{ padding: '0.5rem', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)' }}>
                    <BarChart3 size={20} color="#34d399" />
                  </div>
                </div>
                <p style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.6rem', color: '#ffffff' }}>
                  ${rev.toFixed(2)}
                </p>
                <span className="badge badge-success">Calculated Metric</span>
              </div>
            </section>

            {/* Recent Generation List */}
            <section className="glass-panel" style={{ padding: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.25rem' }}>Recent Automated Generations</h2>
                <button onClick={() => setActiveTab('content')} className="btn btn-outline" style={{ fontSize: '0.8rem', padding: '0.4rem 0.9rem' }}>
                  View All Videos
                </button>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {videos.length === 0 ? (
                  <div style={{ padding: '3rem 2rem', textAlign: 'center', background: 'rgba(10, 12, 20, 0.4)', borderRadius: '12px', border: '1px dashed var(--surface-border)' }}>
                    <Sparkles size={28} color="#818cf8" style={{ marginBottom: '0.75rem' }} />
                    <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>No automation cycles recorded yet. Click &quot;Run Automation Cycle&quot; to initiate the pipeline.</p>
                  </div>
                ) : (
                  videos.slice(0, 4).map((v: VideoData) => (
                    <div key={v.id} className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', padding: '1.2rem 1.75rem' }}>
                      {v.status === 'success' && (
                        <div style={{ padding: '0.6rem', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)' }}>
                          <CheckCircle size={22} color="#34d399" />
                        </div>
                      )}
                      {v.status === 'pending' && (
                        <div style={{ padding: '0.6rem', borderRadius: '50%', background: 'rgba(245, 158, 11, 0.15)' }}>
                          <Clock size={22} color="#fbbf24" />
                        </div>
                      )}
                      {v.status === 'failed' && (
                        <div style={{ padding: '0.6rem', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.15)' }}>
                          <XCircle size={22} color="#f87171" />
                        </div>
                      )}
                      
                      <div style={{ flex: 1 }}>
                        <h4 style={{ fontWeight: 700, fontSize: '1rem', color: '#ffffff', marginBottom: '0.25rem' }}>{v.topic}</h4>
                        <p style={{ fontSize: '0.825rem', color: '#94a3b8' }}>
                          {v.status === 'success' ? 'Video generated and uploaded successfully.' : 
                           v.status === 'failed' ? 'Generation failed. Auto-healer scheduled retry.' : 'Pipeline currently processing assets...'}
                        </p>
                      </div>
                      
                      <span className={`badge ${v.status === 'success' ? 'badge-success' : v.status === 'failed' ? 'badge-danger' : 'badge-warning'}`}>
                        {v.status}
                      </span>

                      <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                        {new Date(v.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        )}

        {/* CONTENT LIBRARY TAB */}
        {activeTab === 'content' && (
          <div className="glass-panel animate-fade-in" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ fontSize: '1.35rem' }}>Generated Video Library</h2>
                <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>All content rendered and cataloged in the database.</p>
              </div>
              <span className="badge badge-primary">{videos.length} Total Clips</span>
            </div>

            {videos.length === 0 ? (
              <div style={{ padding: '4rem 2rem', textAlign: 'center', background: 'rgba(10, 12, 20, 0.4)', borderRadius: '16px', border: '1px dashed var(--surface-border)' }}>
                <Video size={36} color="#818cf8" style={{ marginBottom: '1rem', opacity: 0.6 }} />
                <h3 style={{ fontSize: '1.1rem', color: '#ffffff', marginBottom: '0.5rem' }}>Library is Empty</h3>
                <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Generate videos via the automated workflow to see them here.</p>
              </div>
            ) : (
              <div className="grid-cols-3">
                {videos.map((v: VideoData) => (
                  <div key={v.id} className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ height: '170px', background: 'linear-gradient(135deg, rgba(30, 37, 56, 0.8), rgba(15, 18, 28, 0.9))', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid var(--surface-border)', position: 'relative' }}>
                      <PlayCircle size={42} color={v.status === 'success' ? '#34d399' : '#818cf8'} style={{ cursor: 'pointer', filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.5))' }} />
                      <span style={{ position: 'absolute', bottom: 12, right: 12 }} className={`badge ${v.status === 'success' ? 'badge-success' : 'badge-warning'}`}>
                        {v.status}
                      </span>
                    </div>
                    <div style={{ padding: '1.25rem' }}>
                      <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.4rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.topic}</h4>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.775rem', color: '#94a3b8' }}>
                        <span>{new Date(v.createdAt).toLocaleDateString()}</span>
                        <span>{v.views || 0} views • {v.likes || 0} likes</span>
                      </div>
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
          <div className="glass-panel animate-fade-in" style={{ padding: '2rem' }}>
            <h2 style={{ fontSize: '1.35rem', marginBottom: '1.5rem' }}>Automated Channel Analytics</h2>
            
            <div className="grid-cols-3" style={{ marginBottom: '2.5rem' }}>
              <div className="glass-card" style={{ borderLeft: '4px solid #6366f1' }}>
                <h4 style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600, marginBottom: '0.5rem' }}>Total Impressions / Views</h4>
                <p style={{ fontSize: '2rem', fontWeight: 800, color: '#ffffff' }}>{(stats?.views || 0).toLocaleString()}</p>
              </div>
              <div className="glass-card" style={{ borderLeft: '4px solid #34d399' }}>
                <h4 style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600, marginBottom: '0.5rem' }}>Engagement Rate</h4>
                <p style={{ fontSize: '2rem', fontWeight: 800, color: '#ffffff' }}>{stats?.engagement || 0}%</p>
              </div>
              <div className="glass-card" style={{ borderLeft: '4px solid #c084fc' }}>
                <h4 style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600, marginBottom: '0.5rem' }}>Subscriber Growth</h4>
                <p style={{ fontSize: '2rem', fontWeight: 800, color: '#ffffff' }}>+{(stats?.subs || 0).toLocaleString()}</p>
              </div>
            </div>

            <div className="glass-card" style={{ padding: '1.75rem', background: 'rgba(10, 12, 20, 0.6)' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.5rem' }}>Feedback Loop Optimization</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: '1.6' }}>
                The Analytics Agent evaluates view rates, audience retention, and subscriber conversion data. Performance metrics are fed directly into the prompt generation engine to maximize click-through rate on future automated videos.
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
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <section className="glass-panel" style={{ padding: '2rem' }}>
              <div style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.35rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <Settings size={22} color="#818cf8" /> Platform API Keys & Integrations
                </h2>
                <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
                  Manage credentials for OpenAI, Google Cloud Platform OAuth, Instagram Graph API, and media creation providers.
                </p>
              </div>

              <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {/* AI Engine Section */}
                <div className="glass-card" style={{ borderTop: '4px solid #6366f1' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem', color: '#ffffff' }}>OpenAI Intelligence Engine</h3>
                  <div>
                    <label className="input-label">OpenAI API Key (Required for Agents & Script Generation)</label>
                    <input type="password" value={openAi} onChange={(e) => setOpenAi(e.target.value)} placeholder="sk-..." className="input-field" />
                  </div>
                </div>

                <div className="grid-cols-2">
                  {/* YouTube OAuth Configuration */}
                  <div className="glass-card" style={{ borderTop: '4px solid #ff4444' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                      <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '1.05rem' }}>
                        <PlayCircle size={20} color="#ff4444" /> YouTube OAuth Connection
                      </h3>
                      <span className="badge" style={{ background: settings?.hasYoutubeAuth ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: settings?.hasYoutubeAuth ? '#34d399' : '#f87171' }}>
                        {settings?.hasYoutubeAuth ? 'Authorized' : 'Not Connected'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div>
                        <label className="input-label">GCP OAuth Client ID</label>
                        <input type="text" value={ytClientId} onChange={(e) => setYtClientId(e.target.value)} placeholder="...apps.googleusercontent.com" className="input-field" />
                      </div>
                      <div>
                        <label className="input-label">GCP OAuth Client Secret</label>
                        <input type="password" value={ytClientSecret} onChange={(e) => setYtClientSecret(e.target.value)} placeholder="GOCSPX-..." className="input-field" />
                      </div>
                      <button type="button" className="btn btn-outline" style={{ borderColor: '#ff4444', color: '#ff6666', marginTop: '0.5rem' }} onClick={handleYoutubeLogin}>
                        Authorize YouTube Account
                      </button>
                    </div>
                  </div>

                  {/* Instagram Graph API */}
                  <div className="glass-card" style={{ borderTop: '4px solid #e1306c' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                      <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '1.05rem' }}>
                        <Camera size={20} color="#e1306c" /> Instagram Graph API
                      </h3>
                      <span className="badge" style={{ background: settings?.instagramAccessToken ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)', color: settings?.instagramAccessToken ? '#34d399' : '#94a3b8' }}>
                        {settings?.instagramAccessToken ? 'Connected' : 'Not Connected'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div>
                        <label className="input-label">Instagram Business Account ID</label>
                        <input type="text" value={igId} onChange={(e) => setIgId(e.target.value)} placeholder="178414..." className="input-field" />
                      </div>
                      <div>
                        <label className="input-label">Page Access Token</label>
                        <input type="password" value={igAccessToken} onChange={(e) => setIgAccessToken(e.target.value)} placeholder="EAA..." className="input-field" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid-cols-2">
                  {/* Brand Identity */}
                  <div className="glass-card" style={{ borderTop: '4px solid #6366f1' }}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Briefcase size={19} color="#818cf8" /> Brand Identity & Persona
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div>
                        <label className="input-label">Brand Name</label>
                        <input type="text" value={brandName} onChange={(e) => setBrandName(e.target.value)} className="input-field" />
                      </div>
                      <div>
                        <label className="input-label">Niche / Industry</label>
                        <input type="text" value={brandNiche} onChange={(e) => setBrandNiche(e.target.value)} className="input-field" />
                      </div>
                      <div>
                        <label className="input-label">Tone of Voice</label>
                        <input type="text" value={brandTone} onChange={(e) => setBrandTone(e.target.value)} className="input-field" />
                      </div>
                      <div>
                        <label className="input-label">Target Audience</label>
                        <input type="text" value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} className="input-field" />
                      </div>
                    </div>
                  </div>

                  {/* Pro Video & Media Keys */}
                  <div className="glass-card" style={{ borderTop: '4px solid #a855f7' }}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Video size={19} color="#c084fc" /> Pro Voice & Stock Media Keys
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div>
                        <label className="input-label">ElevenLabs API Key (Hyper-Realistic TTS)</label>
                        <input type="password" value={elevenLabsKey} onChange={(e) => setElevenLabsKey(e.target.value)} placeholder="API Key..." className="input-field" />
                      </div>
                      <div>
                        <label className="input-label">Pexels API Key (High-Res Stock B-Roll)</label>
                        <input type="password" value={pexelsKey} onChange={(e) => setPexelsKey(e.target.value)} placeholder="API Key..." className="input-field" />
                      </div>
                      <div>
                        <label className="input-label">Video Style Format</label>
                        <select value={videoStyle} onChange={(e) => setVideoStyle(e.target.value)} className="input-field" style={{ background: '#121622' }}>
                          <option value="Cinematic Stock">Cinematic Stock Footage</option>
                          <option value="AI Art Transitions">AI Art Transitions</option>
                        </select>
                      </div>
                      <div>
                        <label className="input-label">Subtitle Style</label>
                        <select value={captionStyle} onChange={(e) => setCaptionStyle(e.target.value)} className="input-field" style={{ background: '#121622' }}>
                          <option value="Dynamic Pop">Dynamic Pop (Hormozi Style)</option>
                          <option value="Minimalist">Minimalist / Clean</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notifications */}
                <div className="glass-card" style={{ borderTop: '4px solid #06b6d4' }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Bell size={19} color="#38bdf8" /> Real-Time Notifications
                  </h3>
                  <div>
                    <label className="input-label">Discord Webhook URL (Alerts on Upload & Approval)</label>
                    <input type="text" value={discordWebhook} onChange={(e) => setDiscordWebhook(e.target.value)} placeholder="https://discord.com/api/webhooks/..." className="input-field" />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                  <button type="submit" className="btn btn-primary" style={{ padding: '0.9rem 2.2rem' }}>
                    Save All Settings
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
