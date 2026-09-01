import React from 'react';
import { TrendingUp, Calendar, Zap, MessageSquare, Tag } from 'lucide-react';

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
  const safeParseJSON = (str: string, fallback: any = []) => {
    try {
      return JSON.parse(str);
    } catch (e) {
      return fallback;
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div className="glass-panel" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <div style={{ padding: '0.5rem', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                <TrendingUp size={24} className="text-gradient" />
              </div>
              <h2 style={{ fontSize: '1.5rem' }}>Viral Trend Intelligence Archive</h2>
            </div>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
              Historical log of viral search spikes, market viability scores, and AI competitive analysis.
            </p>
          </div>

          <span className="badge badge-primary" style={{ padding: '0.5rem 1rem' }}>
            {trends.length} Logged Spikes
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {trends.length === 0 ? (
            <div style={{ padding: '4rem 2rem', textAlign: 'center', background: 'rgba(15, 18, 28, 0.4)', border: '1px dashed var(--surface-border)', borderRadius: '16px' }}>
              <Zap size={32} color="#818cf8" style={{ marginBottom: '1rem', opacity: 0.6 }} />
              <h3 style={{ fontSize: '1.1rem', color: '#ffffff', marginBottom: '0.5rem' }}>No Trend Records Found</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
                Run the automated workflow to let the Trend Intelligence agent discover viral topics.
              </p>
            </div>
          ) : (
            trends.map((trend) => {
              const keywords = safeParseJSON(trend.keywords, []);

              return (
                <div key={trend.id} className="glass-card" style={{ padding: '1.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ padding: '0.85rem', borderRadius: '14px', background: trend.isViable ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)', border: `1px solid ${trend.isViable ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 255, 255, 0.08)'}` }}>
                        <Zap size={22} color={trend.isViable ? '#34d399' : '#94a3b8'} />
                      </div>
                      <div>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#ffffff' }}>{trend.topic}</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <Calendar size={13} /> {new Date(trend.createdAt).toLocaleDateString()}
                          </span>
                          <span className="badge badge-cyan" style={{ fontSize: '0.7rem' }}>
                            Traffic Volume: {trend.score ? trend.score.toLocaleString() : 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <span className={`badge ${trend.isViable ? 'badge-success' : 'badge-danger'}`} style={{ padding: '0.4rem 0.9rem' }}>
                      {trend.isViable ? 'High Potential' : 'Low Potential'}
                    </span>
                  </div>

                  <div style={{ marginBottom: '1rem' }}>
                    {keywords.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', marginBottom: '1.25rem' }}>
                        {keywords.map((kw: string, i: number) => (
                          <span key={i} style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem', borderRadius: '20px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)', color: '#cbd5e1', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Tag size={10} color="#818cf8" /> {kw}
                          </span>
                        ))}
                      </div>
                    )}
                    
                    {trend.analysis && (
                      <div style={{ background: 'rgba(10, 12, 20, 0.7)', padding: '1.2rem 1.4rem', borderRadius: '12px', borderLeft: '3px solid #6366f1', border: '1px solid var(--surface-border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                          <MessageSquare size={15} color="#818cf8" />
                          <span style={{ fontSize: '0.775rem', fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>AI Market Strategy Analysis</span>
                        </div>
                        <p style={{ fontSize: '0.875rem', color: '#e2e8f0', lineHeight: '1.6' }}>
                          {trend.analysis}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
