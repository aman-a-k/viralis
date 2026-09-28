"use client";

import React, { useState } from 'react';
import { AgentStatus } from '@/types';
import { Cpu, Terminal, AlertTriangle, RefreshCw, Send, Check } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  agents: AgentStatus[];
}

interface Exchange {
  id: number;
  agent: string;
  prompt: string;
  reply: string;
}

export const AgentStatusView: React.FC<Props> = ({ agents }) => {
  const [command, setCommand] = useState('');
  const [agentId, setAgentId] = useState(agents[0]?.id || 'copy-agent');
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<Exchange[]>([]);

  // Sends a one-off instruction to the chosen agent's persona (brand-aware)
  // and shows its reply. It advises — it doesn't trigger pipeline runs.
  const handleSendCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    const prompt = command.trim();
    if (!prompt || sending) return;
    setSending(true);
    try {
      const res = await fetch('/api/agents/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, prompt }),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(data.error || 'The agent could not answer.', { duration: 7000 });
        return;
      }
      setHistory((h) => [{ id: Date.now(), agent: data.agent, prompt, reply: data.reply }, ...h].slice(0, 10));
      setCommand('');
    } catch {
      toast.error('Network error contacting the agent.');
    } finally {
      setSending(false);
    }
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
              Specialized AI agents behind highlight detection, rendering, copywriting, trend research and performance analysis.
            </p>
          </div>
          <span className="badge badge-neutral" style={{ padding: '0.4rem 0.85rem' }}>
            {agents.length} agents
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
        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.35rem' }}>Ask an agent</h3>
        <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '1.25rem' }}>
          Get advice from a specific agent — hooks, captions, trend angles, edit ideas. Answers use your brand settings. (This doesn&apos;t start pipeline runs; use Repurpose Studio or Run Autopilot for that.)
        </p>

        <form onSubmit={handleSendCommand} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <select className="input-field" style={{ width: 220 }} value={agentId} onChange={(e) => setAgentId(e.target.value)} aria-label="Agent">
            {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="e.g. 'Write three hook lines for a clip about pricing mistakes'"
            className="input-field"
            style={{ flex: '1 1 280px' }}
          />
          <button type="submit" className="btn btn-primary" disabled={sending || !command.trim()}>
            {sending ? <RefreshCw size={15} className="animate-spin" /> : <Send size={15} />} {sending ? 'Asking…' : 'Send'}
          </button>
        </form>

        {history.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1.25rem' }}>
            {history.map((x) => (
              <div key={x.id} style={{ background: 'var(--background)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--surface-border)' }}>
                <p className="text-subtle" style={{ fontSize: '0.72rem', marginBottom: '0.4rem' }}>
                  You → {x.agent}: {x.prompt}
                </p>
                <p style={{ fontSize: '0.8125rem', color: 'var(--foreground)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{x.reply}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
