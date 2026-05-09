import React from 'react';
import { AgentStatus } from '@/types';
import { Bot, Activity, CheckCircle2, AlertCircle, Terminal } from 'lucide-react';

interface Props {
  agents: AgentStatus[];
}

export const AgentStatusView: React.FC<Props> = ({ agents }) => {
  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="grid-cols-3">
        {agents.map((agent) => (
          <div key={agent.id} className="glass-panel" style={{ padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
            {/* Status Glow */}
            <div style={{ 
              position: 'absolute', 
              top: 0, 
              right: 0, 
              width: '4px', 
              height: '100%', 
              background: agent.status === 'working' ? 'var(--primary)' : agent.status === 'error' ? 'var(--danger)' : 'var(--success)',
              boxShadow: `0 0 15px ${agent.status === 'working' ? 'var(--primary)' : agent.status === 'error' ? 'var(--danger)' : 'var(--success)'}`
            }}></div>

            <div className="flex-between" style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ padding: '0.5rem', borderRadius: '8px', background: 'rgba(255,255,255,0.05)' }}>
                  <Bot size={24} color={agent.status === 'working' ? 'var(--primary)' : 'white'} />
                </div>
                <div>
                  <h3 style={{ fontWeight: 600, fontSize: '1rem' }}>{agent.name}</h3>
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{agent.role}</p>
                </div>
              </div>
              {agent.status === 'working' ? (
                <Activity className="animate-spin" size={18} color="var(--primary)" />
              ) : agent.status === 'error' ? (
                <AlertCircle size={18} color="var(--danger)" />
              ) : (
                <CheckCircle2 size={18} color="var(--success)" />
              )}
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <h4 style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Capabilities</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {agent.capabilities.map((cap, i) => (
                  <span key={i} style={{ fontSize: '0.65rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', color: '#cbd5e1' }}>
                    {cap}
                  </span>
                ))}
              </div>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <Terminal size={12} color="#94a3b8" />
                <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>Last Action</span>
              </div>
              <p style={{ fontSize: '0.75rem', color: '#e2e8f0', fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {agent.lastAction}
              </p>
            </div>
          </div>
        ))}
      </div>

      <section className="glass-panel" style={{ padding: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Agent Communication Terminal</h2>
        <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
          Directly instruct the specialized agents or query their internal state.
        </p>
        
        <div style={{ display: 'flex', gap: '1rem' }}>
          <input 
            type="text" 
            placeholder="e.g., 'TrendAgent, find me high-traffic niches in Tech' or 'ContentAgent, optimize for TikTok retention'"
            className="glass-card" 
            style={{ flex: 1, padding: '1rem', color: 'white', border: '1px solid var(--surface-border)' }}
          />
          <button className="btn btn-primary">Send Command</button>
        </div>
      </section>
    </div>
  );
};
