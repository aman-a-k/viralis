import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { TrendingUp, Calendar, MessageSquare, RefreshCw } from 'lucide-react';

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
  onRefreshed?: () => void;
}

const REGIONS: [string, string][] = [
  ['US', 'United States'], ['IN', 'India'], ['GB', 'United Kingdom'], ['CA', 'Canada'],
  ['AU', 'Australia'], ['DE', 'Germany'], ['FR', 'France'], ['BR', 'Brazil'], ['JP', 'Japan'],
];

export const TrendHistoryView: React.FC<Props> = ({ trends, onRefreshed }) => {
  const [region, setRegion] = useState('US');
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/trends/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ region }),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(data.error || 'Could not refresh trends.', { duration: 7000 });
        return;
      }
      if (data.note) toast(data.note, { duration: 7000 });
      else toast.success(`Pulled ${data.saved} live trends.`);
      onRefreshed?.();
    } catch {
      toast.error('Network error refreshing trends.');
    } finally {
      setRefreshing(false);
    }
  };

  const safeParseJSON = (str: string, fallback: any = []) => {
    try {
      return JSON.parse(str);
    } catch (e) {
      return fallback;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="panel-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.25rem' }}>Trend Intelligence Log</h2>
          <p className="text-muted" style={{ fontSize: '0.85rem' }}>
            Today&apos;s real Google search trends, scored for fit with your niche.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <label className="sr-only" htmlFor="trend-region">Region</label>
          <select id="trend-region" className="input-field" style={{ width: 160 }} value={region} onChange={(e) => setRegion(e.target.value)}>
            {REGIONS.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
          </select>
          <button type="button" className="btn btn-primary" onClick={refresh} disabled={refreshing}>
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : undefined} />
            {refreshing ? 'Refreshing…' : 'Refresh trends'}
          </button>
          <span className="badge badge-neutral" style={{ padding: '0.4rem 0.85rem' }}>
            {trends.length} topics
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {trends.length === 0 ? (
          <div className="panel-card" style={{ padding: '3.5rem 2rem', textAlign: 'center', background: 'var(--surface-subtle)' }}>
            <TrendingUp size={32} color="var(--foreground-subtle)" style={{ marginBottom: '0.75rem' }} />
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.35rem' }}>No Trends Recorded</h3>
            <p className="text-muted" style={{ fontSize: '0.85rem' }}>
              Press Refresh trends to pull today&apos;s Google search trends for your region.
            </p>
          </div>
        ) : (
          trends.map((trend) => {
            const keywords = safeParseJSON(trend.keywords, []);

            return (
              <div key={trend.id} className="panel-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--foreground)' }}>{trend.topic}</h3>
                      <span className={`badge ${trend.isViable ? 'badge-success' : 'badge-danger'}`}>
                        {trend.isViable ? 'High Potential' : 'Low Potential'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                      <span className="text-subtle" style={{ fontSize: '0.775rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Calendar size={13} /> {new Date(trend.createdAt).toLocaleDateString()}
                      </span>
                      <span className="text-muted" style={{ fontSize: '0.775rem', fontWeight: 600 }}>
                        Score: {trend.score ? trend.score.toLocaleString() : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                {keywords.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '1rem' }}>
                    {keywords.map((kw: string, i: number) => (
                      <span key={i} className="badge badge-neutral">#{kw}</span>
                    ))}
                  </div>
                )}

                {trend.analysis && (
                  <div style={{ background: 'var(--background)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--surface-border)', borderLeft: '3px solid var(--primary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
                      <MessageSquare size={13} color="var(--primary)" />
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--foreground-muted)', textTransform: 'uppercase' }}>AI Analysis</span>
                    </div>
                    <p className="text-muted" style={{ fontSize: '0.85rem', lineHeight: '1.55' }}>
                      {trend.analysis}
                    </p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
