import React from 'react';
import { TrendingUp, Calendar, Zap, MessageSquare } from 'lucide-react';

interface TrendRecord {
  id: string;
  topic: string;
  score: number;
  keywords: string;
  isViable: boolean;
  analysis: string | null;
  createdAt: string;
}

interface Props {
  trends: TrendRecord[];
}

export const TrendHistoryView: React.FC<Props> = ({ trends }) => {
  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="glass-panel" style={{ padding: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <TrendingUp color="var(--primary)" /> Viral Trend History
        </h2>
        <p style={{ color: '#94a3b8', marginBottom: '2rem' }}>
          Explore the topics identified by the TrendIntelligence agent over time.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {trends.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', border: '1px dashed var(--surface-border)', borderRadius: '12px' }}>
              <p style={{ color: '#64748b' }}>No trend history recorded yet. The agents are still researching.</p>
            </div>
          ) : (
            trends.map((trend) => (
              <div key={trend.id} className="glass-card" style={{ padding: '1.5rem' }}>
                <div className="flex-between" style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ padding: '0.75rem', borderRadius: '12px', background: trend.isViable ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.05)' }}>
                      <Zap size={20} color={trend.isViable ? 'var(--success)' : '#94a3b8'} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>{trend.topic}</h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.25rem' }}>
                         <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                           <Calendar size={12} /> {new Date(trend.createdAt).toLocaleDateString()}
                         </span>
                         <span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>
                           Traffic Score: {trend.score.toLocaleString()}
                         </span>
                      </div>
                    </div>
                  </div>
                  <span className={`badge ${trend.isViable ? 'badge-success' : 'badge-danger'}`}>
                    {trend.isViable ? 'Viable Content' : 'Low Potential'}
                  </span>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                    {JSON.parse(trend.keywords).map((kw: string, i: number) => (
                      <span key={i} style={{ fontSize: '0.7rem', padding: '0.25rem 0.6rem', borderRadius: '20px', border: '1px solid var(--surface-border)', color: '#94a3b8' }}>
                        #{kw}
                      </span>
                    ))}
                  </div>
                  
                  {trend.analysis && (
                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px', borderLeft: '3px solid var(--primary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <MessageSquare size={14} color="var(--primary)" />
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8' }}>AI Analysis</span>
                      </div>
                      <p style={{ fontSize: '0.875rem', color: '#cbd5e1', lineHeight: '1.5' }}>
                        {trend.analysis}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
