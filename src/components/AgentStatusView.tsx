import React, { useState } from 'react';
import { AgentStatus } from '@/types';
import { Cpu, Terminal, Play, CheckCircle, AlertTriangle, RefreshCw, Send, Check } from 'lucide-react';
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
    toast.loading('Dispatching instruction to agent cluster...', { id: 'agent-cmd' });

    setTimeout(() => {
      setIsSending(false);
      toast.success(`Instruction received by agents: "${command}"`, { id: 'agent-cmd', duration: 4000 });
      setCommand('');
    }, 1000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Header Info Banner */}
      <div className="panel-card" style={{ background: 'var(--surface-subtle)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
              <Cpu size={18} color="var(--primary)" />
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700 }}>AI Agent Orchestration Mesh</h2>
            </div>
            <p className="text-muted" style={{ fontSize: '0.85rem' }}>
              Autonomous sub-agents handling trend discovery, scriptwriting, video compilation, and distribution.
            </p>
          </div>
          <span className="badge badge-success" style={{ padding: '0.4rem 0.85rem' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
            5 Agents Active & Operational
          </span>
        </div>
      </div>

      {/* Agents Grid */}
      <div className="grid-cols-3">
        {agents.map((agent) => (
          <div key={agent.id} className="panel-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)' }}>{agent.name}</h3>
                  <p className="text-subtle" style={{ fontSize: '0.775rem' }}>{agent.role}</p>
                </div>
                <span className={`badge ${agent.status === 'working' ? 'badge-primary' : agent.status === 'error' ? 'badge-danger' : 'badge-success'}`}>
                  {agent.status === 'working' ? (
                    <>
                      <RefreshCw className="animate-spin" size={12} />
                      Running
                    </>
                  ) : agent.status === 'error' ? (
                    <>
                      <AlertTriangle size={12} />
                      Error
                    </>
                  ) : (
                    <>
                      <Check size={12} />
                      Idle
                    </>
                  )}
                </span>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <span className="text-subtle" style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.4rem' }}>
                  Capabilities
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                  {agent.capabilities.map((cap, i) => (
                    <span key={i} style={{ fontSize: '0.725rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'var(--surface-subtle)', border: '1px solid var(--surface-border)', color: 'var(--foreground-muted)' }}>
                      {cap}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ background: 'var(--background)', padding: '0.75rem 0.9rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--surface-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
                <Terminal size={12} color="var(--foreground-subtle)" />
                <span style={{ fontSize: '0.7rem', color: 'var(--foreground-subtle)', fontWeight: 600, textTransform: 'uppercase' }}>Last Log</span>
              </div>
              <p style={{ fontSize: '0.775rem', color: 'var(--foreground-muted)', fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {agent.lastAction}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Terminal Dispatch Form */}
      <div className="panel-card">
        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.35rem' }}>Agent Terminal Dispatch</h3>
        <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '1.25rem' }}>
          Issue manual instructions or direct prompts to specific agents in the cluster.
        </p>

        <form onSubmit={handleSendCommand} style={{ display: 'flex', gap: '0.75rem' }}>
          <input 
            type="text" 
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="e.g., 'TrendAgent, research top trending topics in AI software'"
            className="input-field" 
            style={{ flex: 1 }}
          />
          <button type="submit" disabled={isSending} className="btn btn-primary">
            <Send size={15} /> Dispatch
          </button>
        </form>
      </div>
    </div>
  );
};
