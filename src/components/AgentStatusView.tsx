import React, { useState } from 'react';
import { AgentStatus } from '@/types';
import { Bot, Activity, CheckCircle2, AlertCircle, Terminal, Send, Sparkles, Cpu } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  agents: AgentStatus[];
}

export const AgentStatusView: React.FC<Props> = ({ agents }) => {
  const [command, setCommand] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSendCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim()) return;
    setIsSending(true);
    toast.loading('Transmitting command to Agent Cluster...', { id: 'agent-cmd' });

    setTimeout(() => {
      setIsSending(false);
      toast.success(`Command dispatched to Autonomous Agents: "${command}"`, { id: 'agent-cmd', duration: 4000 });
      setCommand('');
    }, 1200);
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Header Banner */}
      <div className="glass-panel" style={{ padding: '1.75rem 2rem', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(168, 85, 247, 0.05) 100%)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <div style={{ padding: '0.5rem', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.2)', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                <Cpu size={22} className="text-gradient" />
              </div>
              <h2 style={{ fontSize: '1.5rem' }}>Autonomous AI Agent Mesh</h2>
            </div>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
              Specialized multi-agent system executing automated trend research, scriptwriting, video rendering, and distribution.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span className="badge badge-success" style={{ padding: '0.5rem 1rem' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399', display: 'inline-block', boxShadow: '0 0 10px #34d399' }}></span>
              Mesh Active (5 Agents)
            </span>
          </div>
        </div>
      </div>

      {/* Agents Grid */}
      <div className="grid-cols-3">
        {agents.map((agent) => (
          <div key={agent.id} className="glass-panel" style={{ padding: '1.75rem', position: 'relative', overflow: 'hidden' }}>
            {/* Status Indicator Bar */}
            <div style={{ 
              position: 'absolute', 
              top: 0, 
              left: 0, 
              right: 0, 
              height: '3px', 
              background: agent.status === 'working' ? 'linear-gradient(90deg, #6366f1, #a855f7)' : agent.status === 'error' ? '#ef4444' : '#10b981',
              boxShadow: `0 0 15px ${agent.status === 'working' ? '#6366f1' : agent.status === 'error' ? '#ef4444' : '#10b981'}`
            }}></div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div style={{ padding: '0.6rem', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <Bot size={24} color={agent.status === 'working' ? '#818cf8' : '#e2e8f0'} />
                </div>
                <div>
                  <h3 style={{ fontWeight: 700, fontSize: '1.05rem', color: '#ffffff' }}>{agent.name}</h3>
                  <p style={{ fontSize: '0.775rem', color: '#94a3b8' }}>{agent.role}</p>
                </div>
              </div>
              
              <span className={`badge ${agent.status === 'working' ? 'badge-primary' : agent.status === 'error' ? 'badge-danger' : 'badge-success'}`}>
                {agent.status === 'working' ? (
                  <>
                    <Activity className="animate-spin" size={13} />
                    Active
                  </>
                ) : agent.status === 'error' ? (
                  <>
                    <AlertCircle size={13} />
                    Error
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={13} />
                    Ready
                  </>
                )}
              </span>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <h4 style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.06em', marginBottom: '0.6rem', fontWeight: 700 }}>Capabilities</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {agent.capabilities.map((cap, i) => (
                  <span key={i} style={{ fontSize: '0.725rem', padding: '0.25rem 0.65rem', borderRadius: '6px', background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.15)', color: '#cbd5e1' }}>
                    {cap}
                  </span>
                ))}
              </div>
            </div>

            <div style={{ background: 'rgba(10, 12, 20, 0.7)', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                <Terminal size={13} color="#818cf8" />
                <span style={{ fontSize: '0.725rem', color: '#818cf8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Latest Log</span>
              </div>
              <p style={{ fontSize: '0.775rem', color: '#e2e8f0', fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {agent.lastAction}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Interactive Command Terminal */}
      <section className="glass-panel" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
          <Sparkles size={20} className="text-gradient" />
          <h3 style={{ fontSize: '1.25rem' }}>Direct Agent Dispatch Terminal</h3>
        </div>
        <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
          Issue natural language instructions to prompt any specific agent or override workflow automation parameters.
        </p>
        
        <form onSubmit={handleSendCommand} style={{ display: 'flex', gap: '1rem' }}>
          <input 
            type="text" 
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="e.g., 'TrendAgent, analyze viral tech topics in AI' or 'ContentAgent, rewrite script with energetic tone'"
            className="input-field" 
            style={{ flex: 1, padding: '0.9rem 1.2rem' }}
          />
          <button type="submit" disabled={isSending} className="btn btn-primary" style={{ padding: '0.9rem 1.75rem' }}>
            <Send size={16} /> Send Dispatch
          </button>
        </form>
      </section>
    </div>
  );
};
