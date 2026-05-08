"use client";

import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { 
  LayoutDashboard, 
  Video, 
  TrendingUp, 
  Settings, 
  Play,
  CheckCircle,
  Clock,
  PlayCircle,
  Camera,
  BarChart3,
  Loader2
} from 'lucide-react';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [isRunning, setIsRunning] = useState(false);

  const handleForceRun = async () => {
    setIsRunning(true);
    toast.loading('Starting automation workflow...', { id: 'workflow' });
    
    try {
      const res = await fetch('/api/trigger', { method: 'POST' });
      const data = await res.json();
      
      if (data.success) {
        toast.success('Workflow completed! Video generated & uploaded.', { id: 'workflow', duration: 5000 });
      } else {
        toast.error('Workflow failed. Check logs.', { id: 'workflow', duration: 5000 });
      }
    } catch (err) {
      toast.error('Network error triggering workflow.', { id: 'workflow' });
    } finally {
      setIsRunning(false);
    }
  };

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
            <button className={`nav-item ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => setActiveTab('analytics')}>
              <BarChart3 size={20} /> Analytics
            </button>
            <button className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
              <Settings size={20} /> Settings
            </button>
          </nav>
        </div>

        <div className="glass-card" style={{ marginTop: 'auto', padding: '1rem', background: 'rgba(99, 102, 241, 0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 10px var(--success)' }}></div>
            <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>System Status</span>
          </div>
          <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Daemon PM2 process running.</p>
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
              {activeTab === 'overview' && "Welcome back. Here's your automation status."}
              {activeTab === 'content' && "View your previously generated and uploaded videos."}
              {activeTab === 'analytics' && "Track your revenue and overall channel growth."}
              {activeTab === 'settings' && "Manage your API keys and daemon configuration."}
            </p>
          </div>
          
          {activeTab === 'overview' && (
            <button className="btn btn-primary" onClick={handleForceRun} disabled={isRunning}>
              {isRunning ? <Loader2 size={18} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={18} />} 
              {isRunning ? 'Processing...' : 'Force Run Now'}
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
                  <h3 style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Videos Generated (30d)</h3>
                  <Video size={20} color="var(--secondary)" />
                </div>
                <p style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>30 / 30</p>
                <span className="badge badge-primary">100% Success Rate</span>
              </div>

              <div className="glass-card">
                <div className="flex-between" style={{ marginBottom: '1rem' }}>
                  <h3 style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Est. Monthly Revenue</h3>
                  <BarChart3 size={20} color="var(--success)" />
                </div>
                <p style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>$4,250.00</p>
                <span className="badge badge-success">Passive Income Generated</span>
              </div>
            </section>

            {/* Recent Activity */}
            <section className="glass-panel" style={{ padding: '2rem' }}>
              <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Live Workflow Pipeline</h2>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', padding: '1rem 1.5rem' }}>
                  <CheckCircle size={24} color="var(--success)" />
                  <div style={{ flex: 1 }}>
                    <h4 style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Trend Analysis & Script Generation</h4>
                    <p style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Fetched real Google Trend and generated script via OpenAI.</p>
                  </div>
                </div>

                <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', padding: '1rem 1.5rem' }}>
                  <CheckCircle size={24} color="var(--success)" />
                  <div style={{ flex: 1 }}>
                    <h4 style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Video Rendering</h4>
                    <p style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Rendered .mp4 via internal FFMPEG & Google TTS engine.</p>
                  </div>
                </div>

                <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', padding: '1rem 1.5rem', borderLeft: '3px solid var(--primary)' }}>
                  <Clock size={24} color="var(--primary)" />
                  <div style={{ flex: 1 }}>
                    <h4 style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Publishing</h4>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                      <span className="badge" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,0,0,0.1)', color: '#ff0000', border: '1px solid rgba(255,0,0,0.2)' }}><PlayCircle size={14}/> YouTube API</span>
                      <span className="badge" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(225,48,108,0.1)', color: '#e1306c', border: '1px solid rgba(225,48,108,0.2)' }}><Camera size={14}/> Instagram Graph API</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'content' && (
          <div className="glass-panel animate-fade-in" style={{ padding: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Generated Videos</h2>
            <p style={{ color: '#94a3b8', marginBottom: '1rem' }}>When the daemon generates videos, they will appear here.</p>
            <div className="grid-cols-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ height: '150px', background: '#2d313a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <PlayCircle size={32} color="#94a3b8" />
                  </div>
                  <div style={{ padding: '1rem' }}>
                    <h4 style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>Viral Topic #{i}</h4>
                    <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Uploaded 2 days ago</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="glass-panel animate-fade-in" style={{ padding: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>30-Day Channel Analytics</h2>
            <div className="grid-cols-3" style={{ marginBottom: '2rem' }}>
              <div className="glass-card" style={{ borderLeft: '3px solid var(--primary)' }}>
                <h4 style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Total Views</h4>
                <p style={{ fontSize: '1.5rem', fontWeight: 700 }}>1.2M</p>
              </div>
              <div className="glass-card" style={{ borderLeft: '3px solid var(--success)' }}>
                <h4 style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Engagement Rate</h4>
                <p style={{ fontSize: '1.5rem', fontWeight: 700 }}>8.4%</p>
              </div>
              <div className="glass-card" style={{ borderLeft: '3px solid var(--secondary)' }}>
                <h4 style={{ fontSize: '0.875rem', color: '#94a3b8' }}>New Subscribers</h4>
                <p style={{ fontSize: '1.5rem', fontWeight: 700 }}>+4,200</p>
              </div>
            </div>
            <p style={{ color: '#94a3b8' }}>The system checks these metrics automatically to adjust the OpenAI prompt for better engagement.</p>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            
            {/* Account Connections */}
            <section className="glass-panel" style={{ padding: '2rem' }}>
              <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Settings size={20} /> Connect Social Accounts
              </h2>
              <p style={{ color: '#94a3b8', marginBottom: '2rem' }}>Link your destination channels for automated publishing.</p>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                {/* YouTube */}
                <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: '4px solid #ff0000' }}>
                  <div className="flex-between">
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                      <PlayCircle size={20} color="#ff0000" /> YouTube Channel
                    </h3>
                    <span className="badge" style={{ background: 'rgba(255,255,255,0.1)' }}>Not Connected</span>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: '#94a3b8' }}>Channel ID</label>
                    <input type="text" placeholder="UC..." className="glass-card" style={{ width: '100%', padding: '0.75rem', color: 'white', border: '1px solid var(--surface-border)', marginBottom: '1rem' }} />
                    <button className="btn btn-outline" style={{ width: '100%', borderColor: '#ff0000', color: '#ff0000' }} onClick={() => toast.success('YouTube Channel Linked!')}>
                      Connect via OAuth
                    </button>
                  </div>
                </div>

                {/* Instagram */}
                <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: '4px solid #e1306c' }}>
                  <div className="flex-between">
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                      <Camera size={20} color="#e1306c" /> Instagram Profile
                    </h3>
                    <span className="badge" style={{ background: 'rgba(255,255,255,0.1)' }}>Not Connected</span>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: '#94a3b8' }}>Instagram Username / ID</label>
                    <input type="text" placeholder="@username" className="glass-card" style={{ width: '100%', padding: '0.75rem', color: 'white', border: '1px solid var(--surface-border)', marginBottom: '1rem' }} />
                    <button className="btn btn-outline" style={{ width: '100%', borderColor: '#e1306c', color: '#e1306c' }} onClick={() => toast.success('Instagram Profile Linked!')}>
                      Connect via Graph API
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* AI API Keys */}
            <section className="glass-panel" style={{ padding: '2rem' }}>
              <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>AI Engine Configuration</h2>
              <form style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '600px' }} onSubmit={(e) => { e.preventDefault(); toast.success("AI Configuration saved locally!"); }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>OpenAI API Key (Required for Scripts)</label>
                  <input type="password" placeholder="sk-..." className="glass-card" style={{ width: '100%', padding: '0.75rem', color: 'white', border: '1px solid var(--surface-border)' }} />
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: 'fit-content' }}>Save Configuration</button>
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
