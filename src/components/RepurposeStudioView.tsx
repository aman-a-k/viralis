"use client";

import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { ProjectData, ClipData } from '@/types';
import {
  Scissors, Copy, Check, Send, Sparkles, RefreshCw, Video, ExternalLink,
  AlertTriangle, FileText, Radar, Smartphone, Square, Monitor, Eye, Rocket,
} from 'lucide-react';

interface Props {
  projects: ProjectData[];
  onRefresh: () => void;
  defaultPlatforms?: string[];
  defaultOrientations?: string[];
  defaultCaptionStyle?: string;
}

const PLATFORMS = ['instagram', 'youtube', 'linkedin', 'twitter', 'tiktok'] as const;
type Platform = (typeof PLATFORMS)[number];
const PLATFORM_LABEL: Record<Platform, string> = {
  instagram: 'Instagram',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  twitter: 'X',
  tiktok: 'TikTok',
};
const ORIENTATIONS = ['9:16', '1:1', '16:9'] as const;
const ORIENTATION_ICON: Record<string, React.ElementType> = { '9:16': Smartphone, '1:1': Square, '16:9': Monitor };
const CATEGORIES: [string, string][] = [
  ['', 'All'], ['24', 'Entertainment'], ['10', 'Music'], ['20', 'Gaming'], ['17', 'Sports'],
  ['23', 'Comedy'], ['25', 'News & Politics'], ['26', 'Howto & Style'], ['27', 'Education'], ['28', 'Science & Tech'],
];
const REGIONS: [string, string][] = [
  ['US', 'United States'], ['GB', 'United Kingdom'], ['IN', 'India'], ['CA', 'Canada'], ['AU', 'Australia'],
];

interface TrendingVideo {
  videoId: string; url: string; title: string; channelTitle: string; thumbnail: string | null;
  viewCount: number; durationSeconds: number;
}

function fmt(s: number): string {
  const t = Math.max(0, Math.floor(s));
  const m = Math.floor(t / 60);
  const sec = t % 60;
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}:${String(m % 60).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function fmtViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function parseAspectRatios(raw: ClipData['aspectRatios']): string[] {
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(String(raw));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseCaptions(raw: ClipData['captionVersions']): Record<string, string> {
  if (raw && typeof raw === 'object') return raw as unknown as Record<string, string>;
  try {
    return JSON.parse(String(raw));
  } catch {
    return { instagram: String(raw || '') };
  }
}

export function RepurposeStudioView({
  projects = [],
  onRefresh,
  defaultPlatforms,
  defaultOrientations,
  defaultCaptionStyle,
}: Props) {
  const [source, setSource] = useState<'trending' | 'link' | 'transcript'>('trending');
  const [trendingMode, setTrendingMode] = useState<'automatic' | 'manual'>('automatic');
  const [url, setUrl] = useState('');
  const [transcript, setTranscript] = useState('');
  const [clipCount, setClipCount] = useState(5);
  const [busy, setBusy] = useState(false);

  // Shared run configuration
  const [platforms, setPlatforms] = useState<string[]>(defaultPlatforms?.length ? defaultPlatforms : [...PLATFORMS]);
  const [orientations, setOrientations] = useState<string[]>(defaultOrientations?.length ? defaultOrientations : [...ORIENTATIONS]);
  const [captionStyle, setCaptionStyleLocal] = useState<'Dynamic Pop' | 'Minimalist'>(
    defaultCaptionStyle === 'Minimalist' ? 'Minimalist' : 'Dynamic Pop'
  );

  // Trending discovery
  const [region, setRegion] = useState('US');
  const [category, setCategory] = useState('');
  const [trendingVideos, setTrendingVideos] = useState<TrendingVideo[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(false);
  const [automating, setAutomating] = useState(false);
  const [lastAutoResult, setLastAutoResult] = useState<{ title: string; channel: string; clipsCreated: number; clipsQueued: number } | null>(null);

  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [platform, setPlatform] = useState<Platform>('instagram');
  const [copiedKey, setCopiedKey] = useState<string>('');

  const activeProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) || projects[0],
    [projects, selectedProjectId]
  );
  const clips = useMemo(
    () => [...(activeProject?.clips || [])].sort((a, b) => (b.viralityScore || 0) - (a.viralityScore || 0)),
    [activeProject]
  );

  const togglePlatform = (p: string) =>
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  const toggleOrientation = (o: string) =>
    setOrientations((prev) => (prev.includes(o) ? prev.filter((x) => x !== o) : [...prev, o]));

  const runConfig = () => ({
    clipCount,
    platforms: platforms.length ? platforms : undefined,
    orientations: orientations.length ? orientations : undefined,
    captionStyle,
  });

  const findTrending = async () => {
    setTrendingLoading(true);
    setTrendingVideos([]);
    try {
      const params = new URLSearchParams({ region, limit: '15' });
      if (category) params.set('category', category);
      const res = await fetch(`/api/trends/videos?${params}`);
      const data = await res.json();
      if (data.success) {
        setTrendingVideos(data.videos);
        if (data.videos.length === 0) toast('No trending videos returned for that filter.');
      } else {
        toast.error(data.error || 'Could not fetch trending videos.', { duration: 7000 });
      }
    } catch {
      toast.error('Network error fetching trending videos.');
    } finally {
      setTrendingLoading(false);
    }
  };

  const useTrendingVideo = (v: TrendingVideo) => {
    setSource('link');
    setUrl(v.url);
    toast.success(`Loaded "${v.title}" — review the config below, then Analyze.`);
  };

  const runAutomatic = async () => {
    setAutomating(true);
    setLastAutoResult(null);
    toast.loading('Finding a trending video for your niche…', { id: 'auto' });
    try {
      const res = await fetch('/api/trends/automate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...runConfig(), region, category: category || undefined }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message, { id: 'auto', duration: 6000 });
        setLastAutoResult({
          title: data.result.video.title,
          channel: data.result.video.channelTitle,
          clipsCreated: data.result.clipsCreated,
          clipsQueued: data.result.clipsQueued,
        });
        setSelectedProjectId(data.result.projectId);
        onRefresh();
      } else {
        toast.error(data.error || 'Automatic run failed.', { id: 'auto', duration: 8000 });
      }
    } catch {
      toast.error('Network error running automatic discovery.', { id: 'auto' });
    } finally {
      setAutomating(false);
    }
  };

  const analyze = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (busy) return;
    const isLink = source === 'link';
    if (isLink && !/youtube\.com|youtu\.be/.test(url)) {
      toast.error('Paste a valid YouTube link.');
      return;
    }
    if (!isLink && transcript.trim().length < 200) {
      toast.error('Paste a transcript of at least ~200 characters.');
      return;
    }

    setBusy(true);
    toast.loading(isLink ? 'Fetching transcript & analyzing…' : 'Analyzing transcript…', { id: 'an' });
    try {
      const res = await fetch(isLink ? '/api/repurpose' : '/api/repurpose/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isLink ? { sourceVideoUrl: url, ...runConfig() } : { transcript, ...runConfig() }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || 'Done', { id: 'an', duration: 4000 });
        setUrl('');
        setTranscript('');
        setSelectedProjectId(data.project.id);
        onRefresh();
      } else {
        toast.error(data.error || 'Analysis failed', { id: 'an', duration: 7000 });
        onRefresh();
      }
    } catch {
      toast.error('Network error contacting the analyzer.', { id: 'an' });
    } finally {
      setBusy(false);
    }
  };

  const reanalyze = async () => {
    if (!activeProject || busy) return;
    setBusy(true);
    toast.loading('Re-analyzing…', { id: 're' });
    try {
      const res = await fetch('/api/repurpose/reanalyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: activeProject.id, ...runConfig() }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message, { id: 're' });
        onRefresh();
      } else {
        toast.error(data.error || 'Failed', { id: 're', duration: 6000 });
      }
    } finally {
      setBusy(false);
    }
  };

  const queueClip = async (clipId: string) => {
    toast.loading('Queueing…', { id: 'q' });
    try {
      const res = await fetch(`/api/repurpose/clip/${clipId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve_to_queue' }),
      });
      const data = await res.json();
      data.success ? toast.success(data.message, { id: 'q' }) : toast.error(data.error, { id: 'q' });
      if (data.success) onRefresh();
    } catch {
      toast.error('Network error.', { id: 'q' });
    }
  };

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success('Copied');
    setTimeout(() => setCopiedKey(''), 1600);
  };

  const shotList = (clip: ClipData) => {
    const caps = parseCaptions(clip.captionVersions);
    const yt = activeProject?.sourceVideoId
      ? `https://youtu.be/${activeProject.sourceVideoId}?t=${Math.floor(clip.startTime)}`
      : '';
    return [
      `${clip.title}`,
      `Timestamp: ${fmt(clip.startTime)} – ${fmt(clip.endTime)}  (${clip.duration}s)`,
      `Virality: ${clip.viralityScore}/100 · ${clip.hookType || 'insight'}`,
      yt ? `Jump to source: ${yt}` : '',
      ``,
      `Why: ${clip.reasoning}`,
      ``,
      `— Transcript —`,
      clip.transcriptSegment,
      ``,
      ...PLATFORMS.map((p) => `— ${PLATFORM_LABEL[p]} —\n${caps[p] || ''}`),
    ].join('\n');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Source picker + analyzer */}
      <div className="panel-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div className="segmented-control">
          <button className={`segmented-item ${source === 'trending' ? 'active' : ''}`} onClick={() => setSource('trending')}>
            <Radar size={13} /> Trending
          </button>
          <button className={`segmented-item ${source === 'link' ? 'active' : ''}`} onClick={() => setSource('link')}>
            <Video size={13} /> YouTube link
          </button>
          <button className={`segmented-item ${source === 'transcript' ? 'active' : ''}`} onClick={() => setSource('transcript')}>
            <FileText size={13} /> Paste transcript
          </button>
        </div>

        {/* TRENDING SOURCE */}
        {source === 'trending' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div className="segmented-control" style={{ alignSelf: 'flex-start' }}>
              <button className={`segmented-item ${trendingMode === 'automatic' ? 'active' : ''}`} onClick={() => setTrendingMode('automatic')}>
                <Rocket size={13} /> Automatic
              </button>
              <button className={`segmented-item ${trendingMode === 'manual' ? 'active' : ''}`} onClick={() => setTrendingMode('manual')}>
                <Eye size={13} /> Manual
              </button>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <select className="input-field" style={{ width: 160 }} value={region} onChange={(e) => setRegion(e.target.value)}>
                {REGIONS.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
              </select>
              <select className="input-field" style={{ width: 180 }} value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>

              {trendingMode === 'manual' ? (
                <button type="button" className="btn btn-secondary" onClick={findTrending} disabled={trendingLoading}>
                  {trendingLoading ? <RefreshCw size={14} className="animate-spin" /> : <Radar size={14} />}
                  {trendingLoading ? 'Finding…' : 'Find trending videos'}
                </button>
              ) : (
                <button type="button" className="btn btn-primary" onClick={runAutomatic} disabled={automating}>
                  {automating ? <RefreshCw size={14} className="animate-spin" /> : <Rocket size={14} />}
                  {automating ? 'Running…' : 'Run automatic discovery'}
                </button>
              )}
            </div>

            {trendingMode === 'automatic' ? (
              <p className="text-subtle" style={{ fontSize: '0.75rem' }}>
                Zero clicks from here: picks the trending video that best fits your Settings niche, analyzes it, and sends every clip straight to the <strong>Approval Queue</strong> for your final review — nothing publishes automatically.
              </p>
            ) : (
              <p className="text-subtle" style={{ fontSize: '0.75rem' }}>
                Browse what&apos;s trending, pick one video, then tune the run config below before analyzing.
              </p>
            )}

            {lastAutoResult && (
              <div className="panel-card" style={{ background: 'var(--bg-elevated)', display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
                <Check size={16} style={{ color: 'var(--green)', flexShrink: 0, marginTop: 2 }} />
                <div style={{ fontSize: '0.8125rem' }}>
                  <strong>{lastAutoResult.title}</strong> <span className="text-subtle">· {lastAutoResult.channel}</span>
                  <p className="text-muted" style={{ marginTop: '0.2rem' }}>
                    {lastAutoResult.clipsCreated} clips created, {lastAutoResult.clipsQueued} sent to the Approval Queue.
                  </p>
                </div>
              </div>
            )}

            {trendingMode === 'manual' && trendingVideos.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem' }}>
                {trendingVideos.map((v) => (
                  <div key={v.videoId} className="panel-card panel-card-interactive" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={() => useTrendingVideo(v)}>
                    <div style={{ position: 'relative', height: 120, background: 'var(--bg-elevated)' }}>
                      {v.thumbnail && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={v.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      )}
                      <span style={{ position: 'absolute', bottom: 6, right: 6, background: 'rgba(0,0,0,0.75)', color: '#fff', fontSize: '0.6875rem', padding: '0.1rem 0.35rem', borderRadius: 4 }}>
                        {fmt(v.durationSeconds)}
                      </span>
                    </div>
                    <div style={{ padding: '0.65rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.3rem', flex: 1 }}>
                      <h4 style={{ fontSize: '0.78125rem', fontWeight: 600, lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{v.title}</h4>
                      <p className="text-subtle" style={{ fontSize: '0.7rem' }}>{v.channelTitle}</p>
                      <p className="text-subtle" style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: 'auto' }}>
                        <Eye size={11} /> {fmtViews(v.viewCount)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* LINK SOURCE */}
        {source === 'link' && (
          <form onSubmit={analyze} style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            <input
              className="input-field"
              style={{ flex: '1 1 320px' }}
              placeholder="https://www.youtube.com/watch?v=…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <button type="submit" className="btn btn-primary" disabled={busy} style={{ minWidth: 150 }}>
              {busy ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {busy ? 'Analyzing…' : 'Analyze'}
            </button>
          </form>
        )}

        {/* TRANSCRIPT SOURCE */}
        {source === 'transcript' && (
          <form onSubmit={analyze} style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            <textarea
              className="input-field"
              style={{ flex: '1 1 100%', minHeight: 120 }}
              placeholder="Paste the full transcript here…"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
            />
            <button type="submit" className="btn btn-primary" disabled={busy} style={{ minWidth: 150 }}>
              {busy ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {busy ? 'Analyzing…' : 'Analyze'}
            </button>
          </form>
        )}

        {/* SHARED RUN CONFIG */}
        {source !== 'trending' && (
          <p className="text-subtle" style={{ fontSize: '0.75rem', marginTop: '-0.4rem' }}>
            Viralis reads the video&apos;s captions, finds the highest-potential moments, and writes native copy for every platform. Cutting the actual MP4 runs on the media worker (not part of this deployment).
          </p>
        )}

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          <span className="eyebrow">Run configuration</span>
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <span className="text-subtle" style={{ fontSize: '0.72rem', fontWeight: 600 }}>Platforms</span>
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                {PLATFORMS.map((p) => (
                  <button key={p} type="button" onClick={() => togglePlatform(p)} className={`filter-chip ${platforms.includes(p) ? 'active' : ''}`}>
                    {PLATFORM_LABEL[p]}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <span className="text-subtle" style={{ fontSize: '0.72rem', fontWeight: 600 }}>Orientation</span>
              <div style={{ display: 'flex', gap: '0.35rem' }}>
                {ORIENTATIONS.map((o) => {
                  const Icon = ORIENTATION_ICON[o];
                  return (
                    <button key={o} type="button" onClick={() => toggleOrientation(o)} className={`filter-chip ${orientations.includes(o) ? 'active' : ''}`}>
                      <Icon size={12} /> {o}
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <span className="text-subtle" style={{ fontSize: '0.72rem', fontWeight: 600 }}>Caption style</span>
              <div className="segmented-control">
                <button type="button" className={`segmented-item ${captionStyle === 'Dynamic Pop' ? 'active' : ''}`} onClick={() => setCaptionStyleLocal('Dynamic Pop')}>Dynamic Pop</button>
                <button type="button" className={`segmented-item ${captionStyle === 'Minimalist' ? 'active' : ''}`} onClick={() => setCaptionStyleLocal('Minimalist')}>Minimalist</button>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <span className="text-subtle" style={{ fontSize: '0.72rem', fontWeight: 600 }}>Clips</span>
              <select className="input-field" style={{ width: 72 }} value={clipCount} onChange={(e) => setClipCount(Number(e.target.value))}>
                {[3, 5, 7, 10].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="panel" style={{ padding: '3.5rem 1.5rem', textAlign: 'center' }}>
          <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: 'var(--accent-subtle)', border: '1px solid var(--accent-line)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#b3a4f0', margin: '0 auto 0.85rem' }}>
            <Scissors size={20} />
          </div>
          <h3 className="section-title" style={{ marginBottom: '0.3rem' }}>Nothing analyzed yet</h3>
          <p className="text-muted" style={{ fontSize: '0.8125rem', maxWidth: 420, margin: '0 auto' }}>
            Run automatic discovery, pick a trending video, or paste a YouTube link. You&apos;ll get ranked viral moments with exact timestamps and ready-to-post captions.
          </p>
        </div>
      ) : (
        <>
          {/* Project switcher */}
          <div className="panel-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            {activeProject?.thumbnail && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={activeProject.thumbnail} alt="" style={{ width: 96, height: 54, objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} />
            )}
            <div style={{ flex: 1, minWidth: 200 }}>
              <select
                className="input-field"
                style={{ fontWeight: 600, maxWidth: 460 }}
                value={activeProject?.id || ''}
                onChange={(e) => setSelectedProjectId(e.target.value)}
              >
                {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
              <p className="text-subtle" style={{ fontSize: '0.75rem', marginTop: '0.35rem' }}>
                {activeProject?.channel && `${activeProject.channel} · `}
                {activeProject?.duration ? `${fmt(activeProject.duration)} · ` : ''}
                {clips.length} clips
                {activeProject?.status === 'failed' && (
                  <span style={{ color: 'var(--red)' }}> · {activeProject.errorMessage || 'analysis failed'}</span>
                )}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {activeProject?.sourceVideoUrl && (
                <a href={activeProject.sourceVideoUrl} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
                  <ExternalLink size={13} /> Source
                </a>
              )}
              <button className="btn btn-secondary btn-sm" disabled={busy} onClick={reanalyze}>
                <RefreshCw size={13} className={busy ? 'animate-spin' : ''} /> Re-analyze
              </button>
            </div>
          </div>

          {activeProject?.status === 'failed' && (
            <div className="panel-card" style={{ borderColor: 'var(--red-line)', display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
              <AlertTriangle size={16} style={{ color: 'var(--red)', flexShrink: 0, marginTop: 2 }} />
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-2)' }}>{activeProject.errorMessage}</p>
            </div>
          )}

          {/* Clip cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {clips.map((clip, i) => {
              const caps = parseCaptions(clip.captionVersions);
              const high = clip.viralityScore >= 85;
              const ytLink = activeProject?.sourceVideoId
                ? `https://youtu.be/${activeProject.sourceVideoId}?t=${Math.floor(clip.startTime)}`
                : null;
              const clipPlatforms = PLATFORMS.filter((p) => caps[p]);
              return (
                <div key={clip.id} className="panel-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
                    <div style={{
                      flexShrink: 0, width: 40, height: 40, borderRadius: 'var(--radius-sm)',
                      background: high ? 'var(--green-subtle)' : 'var(--surface-3)',
                      border: `1px solid ${high ? 'var(--green-line)' : 'var(--border-2)'}`,
                      color: high ? 'var(--green)' : 'var(--text-2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: '0.9rem', fontVariantNumeric: 'tabular-nums',
                    }}>
                      {clip.viralityScore}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                        <span className="text-subtle tnum" style={{ fontSize: '0.75rem' }}>#{i + 1}</span>
                        <span className="badge badge-neutral">{fmt(clip.startTime)}–{fmt(clip.endTime)}</span>
                        <span className="badge badge-neutral">{clip.duration}s</span>
                        {clip.hookType && <span className="badge badge-primary" style={{ textTransform: 'capitalize' }}>{clip.hookType}</span>}
                        {clip.status === 'approved' && <span className="badge badge-success">Queued</span>}
                        {parseAspectRatios(clip.aspectRatios).map((o: string) => (
                          <span key={o} className="badge badge-neutral">{o}</span>
                        ))}
                      </div>
                      <h4 style={{ fontSize: '0.9375rem', fontWeight: 600, lineHeight: 1.35 }}>{clip.title}</h4>
                      <p className="text-muted" style={{ fontSize: '0.8125rem', marginTop: '0.3rem', lineHeight: 1.5 }}>{clip.reasoning}</p>
                    </div>
                  </div>

                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-2)', lineHeight: 1.55, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0.7rem 0.85rem' }}>
                    &ldquo;{clip.transcriptSegment}&rdquo;
                  </p>

                  {/* Platform copy */}
                  <div>
                    <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                      {(clipPlatforms.length ? clipPlatforms : PLATFORMS).map((p) => (
                        <button
                          key={p}
                          onClick={() => setPlatform(p)}
                          className={`filter-chip ${platform === p ? 'active' : ''}`}
                          style={{ fontSize: '0.72rem', padding: '0.25rem 0.55rem' }}
                        >
                          {PLATFORM_LABEL[p]}
                        </button>
                      ))}
                    </div>
                    <div style={{ position: 'relative' }}>
                      <textarea
                        readOnly
                        className="input-field"
                        style={{ minHeight: 96, fontSize: '0.8125rem', paddingRight: '2.5rem' }}
                        value={caps[platform] || '—'}
                      />
                      <button
                        className="icon-btn"
                        style={{ position: 'absolute', top: 6, right: 6 }}
                        onClick={() => copy(caps[platform] || '', `${clip.id}-${platform}`)}
                        aria-label="Copy caption"
                      >
                        {copiedKey === `${clip.id}-${platform}` ? <Check size={14} color="var(--green)" /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {ytLink && (
                      <a href={ytLink} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
                        <Video size={13} /> Play at {fmt(clip.startTime)}
                      </a>
                    )}
                    <button className="btn btn-secondary btn-sm" onClick={() => copy(shotList(clip), `${clip.id}-shot`)}>
                      {copiedKey === `${clip.id}-shot` ? <Check size={13} color="var(--green)" /> : <Copy size={13} />} Copy shot list
                    </button>
                    <button className="btn btn-primary btn-sm" onClick={() => queueClip(clip.id)} disabled={clip.status === 'approved'}>
                      <Send size={13} /> {clip.status === 'approved' ? 'In queue' : 'Send to queue'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
