import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { TrendingUp, Calendar, Sparkles, RefreshCw, Copy, Check, Search } from 'lucide-react';
import { ScoreRing } from './motion';

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
  ['IN', 'India'], ['US', 'United States'], ['GB', 'United Kingdom'], ['CA', 'Canada'],
  ['AU', 'Australia'], ['DE', 'Germany'], ['FR', 'France'], ['BR', 'Brazil'], ['JP', 'Japan'],
];

type Filter = 'all' | 'viable' | 'other';

const parseKeywords = (str: string): string[] => {
  try {
    const v = JSON.parse(str);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
};

const hashtag = (kw: string) => `#${kw.replace(/[^\p{L}\p{N}]+/gu, '')}`;

export const TrendHistoryView: React.FC<Props> = ({ trends, onRefreshed }) => {
  const [region, setRegion] = useState('IN');
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

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

  const copyTags = async (trend: TrendRecord) => {
    const tags = parseKeywords(trend.keywords).map(hashtag).join(' ');
    try {
      await navigator.clipboard.writeText(tags);
      setCopied(trend.id);
      toast.success('Hashtags copied.');
      setTimeout(() => setCopied((c) => (c === trend.id ? null : c)), 1600);
    } catch {
      toast.error('Couldn’t copy — your browser blocked clipboard access.');
    }
  };

  const viableCount = trends.filter((t) => t.isViable).length;
  const q = query.trim().toLowerCase();
  const shown = trends
    .filter((t) => (filter === 'all' ? true : filter === 'viable' ? t.isViable : !t.isViable))
    .filter((t) => !q || t.topic.toLowerCase().includes(q) || t.keywords.toLowerCase().includes(q));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <section className="panel-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div className="page-toolbar">
          <div className="section-head">
            <span className="section-icon"><TrendingUp /></span>
            <div>
              <h2 className="section-title">Live search trends</h2>
              <p>Pulled from Google Trends and scored for how well each fits your niche.</p>
            </div>
          </div>
          <div className="tools">
            <label className="sr-only" htmlFor="trend-region">Region</label>
            <select id="trend-region" className="input-field" style={{ width: 160 }} value={region} onChange={(e) => setRegion(e.target.value)}>
              {REGIONS.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
            </select>
            <button type="button" className="btn btn-primary" onClick={refresh} disabled={refreshing}>
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : undefined} />
              {refreshing ? 'Refreshing…' : 'Refresh trends'}
            </button>
          </div>
        </div>
        <div className={`refresh-bar ${refreshing ? 'on' : ''}`} aria-hidden="true" />
        {trends.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }} role="group" aria-label="Filter trends">
              {([['all', `All · ${trends.length}`], ['viable', `High potential · ${viableCount}`], ['other', `Low potential · ${trends.length - viableCount}`]] as [Filter, string][]).map(([f, label]) => (
                <button key={f} type="button" aria-pressed={filter === f} className={`filter-chip ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>{label}</button>
              ))}
            </div>
            <div className="list-search" style={{ marginBottom: 0, width: 220, maxWidth: '100%' }}>
              <Search />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search topics" aria-label="Search topics" />
            </div>
          </div>
        )}
      </section>

      {trends.length === 0 ? (
        <section className="panel empty-state">
          <span className="section-icon" style={{ width: 44, height: 44, borderRadius: 12 }}><TrendingUp /></span>
          <h3 className="section-title" style={{ marginTop: '0.4rem' }}>No trends yet</h3>
          <p className="text-muted" style={{ fontSize: '0.82rem', maxWidth: 420 }}>
            Press <b>Refresh trends</b> to pull today’s Google search trends for your region, scored for your niche.
          </p>
          <button type="button" className="btn btn-primary" style={{ marginTop: '0.5rem' }} onClick={refresh} disabled={refreshing}>
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : undefined} /> Refresh trends
          </button>
        </section>
      ) : shown.length === 0 ? (
        <p className="text-subtle" style={{ fontSize: '0.82rem', textAlign: 'center', padding: '2rem' }}>No trends match this filter.</p>
      ) : (
        <div className="trend-list stagger" key={`${filter}-${q}`}>
          {shown.map((trend) => {
            const keywords = parseKeywords(trend.keywords);
            const fit = trend.score >= 0 && trend.score <= 100;
            return (
              <article key={trend.id} className="panel-card trend-card spot">
                {fit ? <ScoreRing value={trend.score} size={46} label={`Niche fit ${trend.score}/100`} /> : <span className="section-icon neutral" style={{ width: 46, height: 46, borderRadius: '50%' }}><TrendingUp /></span>}
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
                    <h3>{trend.topic}</h3>
                    <span className={`badge badge-dot ${trend.isViable ? 'badge-success' : 'badge-neutral'}`}>{trend.isViable ? 'High potential' : 'Low potential'}</span>
                  </div>
                  <div className="trend-meta">
                    <span><Calendar size={12} /> {new Date(trend.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    <span className="tnum">{fit ? `Niche fit ${trend.score}/100` : `Search volume ${trend.score.toLocaleString()}`}</span>
                  </div>
                  {keywords.length > 0 && <div className="kw-row">{keywords.map((kw, i) => <span key={i} className="kw">{hashtag(kw)}</span>)}</div>}
                  {trend.analysis && (
                    <div className="analysis">
                      <p className="analysis-label"><Sparkles size={11} /> Why it fits</p>
                      {trend.analysis}
                    </div>
                  )}
                  {keywords.length > 0 && (
                    <div className="trend-actions">
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => copyTags(trend)}>
                        {copied === trend.id ? <Check size={13} color="var(--green)" /> : <Copy size={13} />} Copy hashtags
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
