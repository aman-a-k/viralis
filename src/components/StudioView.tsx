"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Upload, Link2, FileText, Radar, Rocket, RefreshCw, Sparkles, Film, AlertTriangle, Trash2, Flame, Coffee, TrendingUp, BookOpen, Eye, Video, ChevronDown, Search, X,
} from 'lucide-react';
import type { ClipData, DashboardData, ProjectData } from '@/types';
import { api, errorMessage, fmtTime, fmtViews, fmtDate, readMediaDuration, LANGUAGES, clipCountLabel } from '@/lib/client';
import { ClipCard } from './ClipCard';
import { ClipEditor } from './ClipEditor';

export type StudioMode = 'upload' | 'link' | 'transcript' | 'browse' | 'automatic';
type Mode = StudioMode;
type Vibe = 'hook' | 'calm' | 'trendy' | 'story';

const VIBE_LABEL: Record<Vibe, string> = { hook: 'Hook-heavy', calm: 'Calm & informative', trendy: 'Trendy & fast', story: 'Story-driven' };
const VIBE_ICON: Record<Vibe, React.ElementType> = { hook: Flame, calm: Coffee, trendy: TrendingUp, story: BookOpen };
const CATEGORIES: [string, string][] = [
  ['', 'All'], ['27', 'Education'], ['28', 'Science & Tech'], ['26', 'Howto & Style'], ['22', 'People & Blogs'], ['24', 'Entertainment'],
  ['25', 'News & Politics'], ['17', 'Sports'], ['20', 'Gaming'], ['10', 'Music'], ['23', 'Comedy'],
];
const REGIONS: [string, string][] = [['IN', 'India'], ['US', 'United States'], ['GB', 'United Kingdom'], ['CA', 'Canada'], ['AU', 'Australia']];
const PLATFORMS: [string, string][] = [['youtube', 'YouTube'], ['instagram', 'Instagram'], ['tiktok', 'TikTok'], ['linkedin', 'LinkedIn'], ['twitter', 'X']];

interface TrendingVideo {
  videoId: string; url: string; title: string; channelTitle: string; thumbnail: string | null; viewCount: number; durationSeconds: number; vibe: Vibe;
}

const PROCESSING = new Set(['queued', 'transcribing', 'analyzing', 'processing']);

const STATUS_TEXT: Record<string, string> = {
  queued: 'Waiting to start',
  transcribing: 'Transcribing',
  analyzing: 'Finding clips',
  processing: 'Processing',
  ready: 'Ready',
  failed: 'Failed',
};

interface Props {
  data: DashboardData;
  onRefresh: () => void;
  onGoToSettings: () => void;
  onGoToBilling: () => void;
  initialMode?: StudioMode;
  initialProjectId?: string;
}

export function StudioView({ data, onRefresh, onGoToSettings, onGoToBilling, initialMode, initialProjectId }: Props) {
  const { plan, settings } = data;
  const remainingMin = Math.max(0, plan.limits.sourceMinutes - plan.used.sourceMinutes);
  const noPlan = plan.source === 'none';

  const [mode, setMode] = useState<Mode>(initialMode || (data.capabilities.uploads ? 'upload' : 'link'));
  const [busy, setBusy] = useState(false);
  const [rights, setRights] = useState(false);
  const [showOptions, setShowOptions] = useState(false);

  // Shared options
  const [language, setLanguage] = useState(settings.defaultLanguage || 'auto');
  const [clipCount, setClipCount] = useState(5);
  const [captionStyle, setCaptionStyle] = useState(settings.captionStyle === 'Minimalist' ? 'Minimalist' : 'Dynamic Pop');
  const [platforms, setPlatforms] = useState<string[]>(settings.defaultPlatforms);

  // Upload
  const [file, setFile] = useState<File | null>(null);
  const [fileDuration, setFileDuration] = useState(0);
  const [uploadTitle, setUploadTitle] = useState('');
  const [progress, setProgress] = useState<number | null>(null);
  // Link
  const [url, setUrl] = useState('');
  // Transcript
  const [transcriptTitle, setTranscriptTitle] = useState('');
  const [transcript, setTranscript] = useState('');
  // Trending
  const [region, setRegion] = useState('IN');
  const [category, setCategory] = useState('');
  const [vibe, setVibe] = useState<Vibe | 'all'>('all');
  const [trending, setTrending] = useState<TrendingVideo[]>([]);
  const [trendingNext, setTrendingNext] = useState<string | null>(null);
  const [trendingNotice, setTrendingNotice] = useState<string | null>(null);
  const [trendingAt, setTrendingAt] = useState<string | null>(null);
  const [trendingError, setTrendingError] = useState<string | null>(null);
  const [trendingLoading, setTrendingLoading] = useState(false);

  // Projects (server list, overlaid with fresher per-project polls)
  const [overrides, setOverrides] = useState<Record<string, ProjectData>>({});
  const projects = useMemo(() => data.projects.map((p) => {
    const o = overrides[p.id];
    return o && new Date(o.updatedAt) >= new Date(p.updatedAt) ? o : p;
  }), [data.projects, overrides]);
  const [selectedId, setSelectedId] = useState<string>(initialProjectId || '');
  const [projectQuery, setProjectQuery] = useState('');
  const [dragging, setDragging] = useState(false);
  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  const selected = projects.find((p) => p.id === selectedId) || projects[0];
  const [editing, setEditing] = useState<string | null>(null);
  const closeEditor = useCallback(() => setEditing(null), []);
  const [clipFilter, setClipFilter] = useState<'active' | 'all'>('active');

  const config = () => ({ language, clipCount, captionStyle, platforms: platforms.length ? platforms : undefined, orientations: settings.defaultOrientations });

  const setProject = useCallback((p: ProjectData) => setOverrides((prev) => ({ ...prev, [p.id]: p })), []);

  const started = (project: ProjectData) => {
    setProject(project);
    setSelectedId(project.id);
    onRefresh();
  };

  const handleError = (err: unknown) => {
    const msg = errorMessage(err);
    toast.error(msg, { duration: 9000 });
    if (/plan|upgrade|allowance/i.test(msg)) onGoToBilling();
  };

  // ── Starting work ──────────────────────────────────────────────────────
  const chooseFile = async (f: File | null) => {
    setFile(f);
    setFileDuration(0);
    if (f) {
      setUploadTitle((t) => t || f.name.replace(/\.[^.]+$/, ''));
      setFileDuration(await readMediaDuration(f));
    }
  };

  const startUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || busy) return;
    if (!/^(video|audio)\//.test(file.type)) return void toast.error('Choose a video or audio file.');
    if (file.size > plan.maxUploadMb * 1024 * 1024) return void toast.error(`Your plan accepts files up to ${plan.maxUploadMb} MB.`);
    if (fileDuration && fileDuration > plan.maxSourceMinutes * 60) return void toast.error(`Your plan accepts recordings up to ${plan.maxSourceMinutes} minutes.`);
    if (!rights) return void toast.error('Confirm you own this recording or have permission to use it.');

    setBusy(true);
    setProgress(0);
    try {
      const { upload } = await import('@vercel/blob/client');
      const safe = file.name.normalize('NFKD').replace(/[^\w.-]+/g, '_').slice(-80) || 'recording.mp4';
      const blob = await upload(`ws/${data.workspace.id}/sources/${safe}`, file, {
        access: data.capabilities.storageAccess,
        handleUploadUrl: '/api/repurpose/upload-token',
        multipart: file.size > 50 * 1024 * 1024,
        onUploadProgress: ({ percentage }) => setProgress(Math.round(percentage)),
      });
      setProgress(null);
      const res = await api<{ project: ProjectData }>('/api/repurpose/upload', {
        body: { blobPath: blob.pathname, title: uploadTitle, durationSeconds: fileDuration, rightsConfirmed: true, ...config() },
      });
      toast.success('Uploaded. Transcribing now — you can leave this page; we’ll keep working.');
      setFile(null);
      setUploadTitle('');
      started(res.project);
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const startLink = async (e?: React.FormEvent, link = url) => {
    e?.preventDefault();
    if (busy) return;
    if (!/youtube\.com|youtu\.be/.test(link)) return void toast.error('Paste a YouTube video link.');
    if (!rights) return void toast.error('Confirm you own this video or have the rights holder’s permission.');
    setBusy(true);
    try {
      const res = await api<{ project: ProjectData }>('/api/repurpose', { body: { sourceVideoUrl: link, rightsConfirmed: true, ...config() } });
      toast.success('Started. Clips appear here as soon as they’re found.');
      setUrl('');
      started(res.project);
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
    }
  };

  const startTranscript = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (transcript.trim().length < 200) return void toast.error('Paste at least ~200 characters of transcript.');
    setBusy(true);
    try {
      const res = await api<{ project: ProjectData }>('/api/repurpose', { body: { transcriptText: transcript, title: transcriptTitle, ...config() } });
      toast.success('Finding clips in your transcript…');
      setTranscript('');
      setTranscriptTitle('');
      started(res.project);
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
    }
  };

  const runAutomatic = async () => {
    if (busy) return;
    if (!rights) return void toast.error('Confirm you have the rights to reuse the video that gets picked.');
    setBusy(true);
    try {
      const res = await api<{ project: ProjectData; message: string }>('/api/trends/automate', {
        body: { ...config(), region, category: category || undefined, rightsConfirmed: true },
      });
      toast.success(res.message, { duration: 7000 });
      started(res.project);
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
    }
  };

  // ── Trending browse ────────────────────────────────────────────────────
  const findTrending = useCallback(async (append = false, filters?: { region?: string; category?: string }) => {
    const r = filters?.region ?? region;
    const c = filters?.category ?? category;
    setTrendingLoading(true);
    setTrendingError(null);
    try {
      const params = new URLSearchParams({ region: r, limit: '15' });
      if (c) params.set('category', c);
      if (append && trendingNext) params.set('pageToken', trendingNext);
      const res = await api<{ videos: TrendingVideo[]; nextPageToken: string | null; notice?: string; fetchedAt: string }>(`/api/trends/videos?${params}`);
      setTrending((prev) => {
        if (!append) return res.videos;
        const seen = new Set(prev.map((v) => v.videoId));
        return [...prev, ...res.videos.filter((v) => !seen.has(v.videoId))];
      });
      setTrendingNext(res.nextPageToken);
      setTrendingNotice(res.notice || null);
      setTrendingAt(res.fetchedAt);
    } catch (err) {
      setTrendingError(errorMessage(err));
    } finally {
      setTrendingLoading(false);
    }
  }, [region, category, trendingNext]);


  // Opened straight into "Browse trending" (from the command menu): load the chart.
  useEffect(() => {
    if (initialMode !== 'browse') return;
    const t = setTimeout(() => findTrending(false), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renameProject = async () => {
    if (!selected || titleDraft === null) return;
    const next = titleDraft.trim();
    setTitleDraft(null);
    if (!next || next === selected.title) return;
    try {
      const res = await api<{ project: ProjectData }>(`/api/projects/${selected.id}`, { method: 'PATCH', body: { title: next } });
      setProject(res.project);
      onRefresh();
      toast.success('Renamed.');
    } catch (err) {
      handleError(err);
    }
  };

  // ── Following progress ────────────────────────────────────────────────
  const watching = useMemo(
    () => projects.filter((p) => PROCESSING.has(p.status) || p.clips.some((c) => c.renderStatus === 'queued' || c.renderStatus === 'rendering')).map((p) => p.id),
    [projects]
  );
  useEffect(() => {
    if (!watching.length) return;
    let stop = false;
    const tick = async () => {
      for (const id of watching) {
        try {
          const res = await api<{ project: ProjectData }>(`/api/projects/${id}`);
          if (stop) return;
          const before = projects.find((p) => p.id === id);
          setProject(res.project);
          if (before && PROCESSING.has(before.status) && res.project.status === 'ready') toast.success(`“${res.project.title}” is ready — ${res.project.clips.length} clips.`);
          if (before && PROCESSING.has(before.status) && res.project.status === 'failed') toast.error(res.project.errorMessage || 'Processing failed.', { duration: 9000 });
          for (const c of res.project.clips) {
            const prev = before?.clips.find((x) => x.id === c.id);
            if (prev && (prev.renderStatus === 'queued' || prev.renderStatus === 'rendering') && c.renderStatus === 'rendered') toast.success(`“${c.title}” exported.`);
            if (prev && (prev.renderStatus === 'queued' || prev.renderStatus === 'rendering') && c.renderStatus === 'failed') toast.error(c.renderError || 'Export failed.');
          }
        } catch {
          /* transient — next tick */
        }
      }
    };
    const timer = setInterval(tick, 5000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [watching, projects, setProject]);

  const updateClip = (clip: ClipData) => {
    if (!selected) return;
    setProject({ ...selected, updatedAt: new Date().toISOString(), clips: selected.clips.map((c) => (c.id === clip.id ? clip : c)) });
    if (clip.renderStatus === 'queued' || clip.status !== selected.clips.find((c) => c.id === clip.id)?.status) onRefresh();
  };

  const reanalyze = async () => {
    if (!selected || busy) return;
    setBusy(true);
    try {
      const res = await api<{ project: ProjectData }>('/api/repurpose/reanalyze', { body: { projectId: selected.id, ...config() } });
      setProject(res.project);
      toast.success('Looking for clips again…');
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
    }
  };

  const deleteProject = async () => {
    if (!selected) return;
    if (!window.confirm(`Delete “${selected.title}”, its clips and its stored video files? This can’t be undone.`)) return;
    try {
      await api(`/api/projects/${selected.id}`, { method: 'DELETE' });
      toast.success('Project deleted.');
      setSelectedId('');
      onRefresh();
    } catch (err) {
      handleError(err);
    }
  };

  const visibleTrending = vibe === 'all' ? trending : trending.filter((v) => v.vibe === vibe);
  const listed = projectQuery.trim() ? projects.filter((p) => p.title.toLowerCase().includes(projectQuery.trim().toLowerCase())) : projects;
  const clips = (selected?.clips || []).filter((c) => clipFilter === 'all' || c.status !== 'rejected');
  const rejectedCount = (selected?.clips || []).filter((c) => c.status === 'rejected').length;

  const modes: [Mode, string, React.ElementType][] = [
    ['upload', 'Upload a recording', Upload],
    ['link', 'YouTube link', Link2],
    ['transcript', 'Paste transcript', FileText],
    ['browse', 'Browse trending', Radar],
    ['automatic', 'Automatic', Rocket],
  ];

  const rightsBox = (label: string) => (
    <label className="check-row">
      <input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} />
      <span>{label} <a href="/content-policy" target="_blank" className="link">Content policy</a></span>
    </label>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* ── New project ── */}
      <section className="panel-card" aria-labelledby="new-project" style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap' }}>
          <h2 id="new-project" className="section-title">New project</h2>
          <button type="button" className="text-subtle link-button" onClick={onGoToBilling} style={{ fontSize: '0.75rem' }}>
            {plan.source === 'unlimited' ? 'Internal account · unmetered' : noPlan ? 'No plan — choose one to start' : `${remainingMin} of ${plan.limits.sourceMinutes} processing minutes left`}
          </button>
        </div>

        {noPlan && (
          <div className="notice notice-warning">
            <AlertTriangle size={15} /> <span>Your trial allowance is used up or unavailable. <button type="button" className="link-button" onClick={onGoToBilling}>See plans</button> to keep processing recordings.</span>
          </div>
        )}

        <div className="segmented-control" role="tablist" aria-label="How to add a recording" style={{ alignSelf: 'flex-start', flexWrap: 'wrap' }}>
          {modes.map(([id, label, Icon]) => (
            <button key={id} type="button" role="tab" aria-selected={mode === id} className={`segmented-item ${mode === id ? 'active' : ''}`} onClick={() => { setMode(id); if (id === 'browse' && trending.length === 0) findTrending(false); }}>
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        {mode === 'upload' && !data.capabilities.uploads && (
          <div className="notice">
            <AlertTriangle size={15} />
            <span>File uploads aren’t switched on for this workspace yet. You can still <button type="button" className="link-button" onClick={() => setMode('link')}>use a YouTube link</button> or <button type="button" className="link-button" onClick={() => setMode('transcript')}>paste a transcript</button>.</span>
          </div>
        )}

        {mode === 'upload' && data.capabilities.uploads && (
          <form onSubmit={startUpload} style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
            <p className="text-subtle" style={{ fontSize: '0.78rem' }}>
              A lesson, webinar, interview or talk you recorded. Files stay private to your workspace.
            </p>
            <label
              className={`dropzone ${dragging ? 'drag' : ''} ${file ? 'has-file' : ''}`}
              onDragOver={(e) => { e.preventDefault(); if (!busy) setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); if (!busy && e.dataTransfer.files?.[0]) chooseFile(e.dataTransfer.files[0]); }}
            >
              <span className="dz-icon">{file ? <Film size={20} /> : <Upload size={20} />}</span>
              {file ? (
                <>
                  <span style={{ fontWeight: 650, fontSize: '0.88rem', maxWidth: '100%' }} className="truncate">{file.name}</span>
                  <span className="text-subtle tnum" style={{ fontSize: '0.75rem' }}>
                    {(file.size / 1024 / 1024).toFixed(0)} MB{fileDuration ? ` · ${fmtTime(fileDuration)}` : ''}
                    {fileDuration ? ` · uses ~${Math.ceil(fileDuration / 60)} min` : ''} · <span className="link">Choose another</span>
                  </span>
                </>
              ) : (
                <>
                  <span style={{ fontWeight: 650, fontSize: '0.88rem' }}>Drop your recording here, or <span style={{ color: 'var(--accent-hover)' }}>browse</span></span>
                  <span className="text-subtle" style={{ fontSize: '0.75rem' }}>MP4, MOV, WebM or audio · up to {plan.maxUploadMb} MB · {plan.maxSourceMinutes} min</span>
                </>
              )}
              <input type="file" accept="video/*,audio/*" disabled={busy} className="sr-only" onChange={(e) => chooseFile(e.target.files?.[0] || null)} />
            </label>
            <div className="form-group">
              <label className="form-label" htmlFor="up-title">Title</label>
              <input id="up-title" className="input-field" value={uploadTitle} maxLength={200} onChange={(e) => setUploadTitle(e.target.value)} placeholder="e.g. Week 3 — Thermodynamics basics" />
            </div>
            {rightsBox('I own this recording or have permission to use it.')}
            {progress !== null && (
              <div className="progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Upload progress">
                <div style={{ width: `${progress}%` }} />
              </div>
            )}
            <button type="submit" className="btn btn-primary" disabled={busy || !file || noPlan || !data.capabilities.uploads} style={{ alignSelf: 'flex-start' }}>
              {busy ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
              {progress !== null ? `Uploading ${progress}%` : 'Upload & find clips'}
            </button>
          </form>
        )}

        {mode === 'link' && (
          <form onSubmit={startLink} style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="yt-url">YouTube video link</label>
              <input id="yt-url" className="input-field" placeholder="https://www.youtube.com/watch?v=…" value={url} onChange={(e) => setUrl(e.target.value)} />
            </div>
            {rightsBox('This is my video, or I have the rights holder’s permission to reuse it.')}
            <button type="submit" className="btn btn-primary" disabled={busy || !url || noPlan} style={{ alignSelf: 'flex-start' }}>
              {busy ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />} Find clips
            </button>
          </form>
        )}

        {mode === 'transcript' && (
          <form onSubmit={startTranscript} style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
            <p className="text-subtle" style={{ fontSize: '0.78rem' }}>No video? Paste a transcript to get clip ideas and captions you can cut yourself. (Exporting video needs an upload or link.)</p>
            <div className="form-group">
              <label className="form-label" htmlFor="tr-title">Title</label>
              <input id="tr-title" className="input-field" value={transcriptTitle} maxLength={200} onChange={(e) => setTranscriptTitle(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="tr-text">Transcript</label>
              <textarea id="tr-text" className="input-field" style={{ minHeight: 140 }} value={transcript} onChange={(e) => setTranscript(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-primary" disabled={busy || noPlan} style={{ alignSelf: 'flex-start' }}>
              {busy ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />} Find clips
            </button>
          </form>
        )}

        {(mode === 'browse' || mode === 'automatic') && (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <label className="sr-only" htmlFor="tr-region">Region</label>
            <select id="tr-region" className="input-field" style={{ width: 160 }} value={region} onChange={(e) => { setRegion(e.target.value); if (mode === 'browse') findTrending(false, { region: e.target.value }); }}>
              {REGIONS.map(([c, l]) => <option key={c} value={c}>{l}</option>)}
            </select>
            <label className="sr-only" htmlFor="tr-cat">Category</label>
            <select id="tr-cat" className="input-field" style={{ width: 180 }} value={category} onChange={(e) => { setCategory(e.target.value); if (mode === 'browse') findTrending(false, { category: e.target.value }); }}>
              {CATEGORIES.map(([c, l]) => <option key={c} value={c}>{l}</option>)}
            </select>
            {mode === 'browse' && (
              <>
                <button type="button" className="btn btn-secondary" onClick={() => findTrending(false)} disabled={trendingLoading}>
                  <RefreshCw size={14} className={trendingLoading ? 'animate-spin' : undefined} /> {trendingLoading ? 'Loading…' : 'Refresh'}
                </button>
                {trendingAt && !trendingLoading && (
                  <span className="text-subtle" style={{ fontSize: '0.7rem' }} aria-live="polite">
                    Updated {new Date(trendingAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · YouTube refreshes this chart a few times a day
                  </span>
                )}
              </>
            )}
          </div>
        )}

        {mode === 'browse' && (
          <>
            <p className="text-subtle" style={{ fontSize: '0.75rem' }}>For research and inspiration. Only turn a video into clips if it’s yours or you have permission — reused content can’t be monetized on YouTube.</p>
            {trendingNotice && <p className="text-subtle" style={{ fontSize: '0.75rem' }} role="status">{trendingNotice}</p>}
            {trendingError && <p className="inline-error" role="alert"><AlertTriangle size={13} /> {trendingError}</p>}
            {trending.length > 0 && (
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                <button type="button" className={`filter-chip ${vibe === 'all' ? 'active' : ''}`} onClick={() => setVibe('all')}>All</button>
                {(Object.keys(VIBE_LABEL) as Vibe[]).map((v) => {
                  const Icon = VIBE_ICON[v];
                  return <button key={v} type="button" className={`filter-chip ${vibe === v ? 'active' : ''}`} onClick={() => setVibe(v)}><Icon size={12} /> {VIBE_LABEL[v]}</button>;
                })}
              </div>
            )}
            <div className="trending-grid">
              {visibleTrending.map((v) => {
                const Icon = VIBE_ICON[v.vibe];
                return (
                  <div key={v.videoId} className="panel-card trending-card">
                    <div className="trending-thumb">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {v.thumbnail && <img src={v.thumbnail} alt="" loading="lazy" />}
                      <span className="thumb-chip" style={{ bottom: 6, right: 6 }}>{fmtTime(v.durationSeconds)}</span>
                      <span className="thumb-chip" style={{ top: 6, left: 6 }}><Icon size={10} /> {VIBE_LABEL[v.vibe]}</span>
                    </div>
                    <div style={{ padding: '0.65rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.3rem', flex: 1 }}>
                      <h4 className="clamp-2" style={{ fontSize: '0.78rem', fontWeight: 600, lineHeight: 1.35 }}>{v.title}</h4>
                      <p className="text-subtle" style={{ fontSize: '0.7rem' }}>{v.channelTitle} · <Eye size={10} /> {fmtViews(v.viewCount)}</p>
                      <div style={{ display: 'flex', gap: '0.4rem', marginTop: 'auto', paddingTop: '0.3rem' }}>
                        <button type="button" className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => { setUrl(v.url); setMode('link'); setRights(false); }}>
                          <Sparkles size={12} /> Use this video
                        </button>
                        <a href={v.url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" aria-label={`Watch ${v.title} on YouTube`}><Video size={12} /></a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {trendingNext && trending.length > 0 && (
              <button type="button" className="btn btn-secondary btn-sm" style={{ alignSelf: 'center' }} onClick={() => findTrending(true)} disabled={trendingLoading}>Load more</button>
            )}
          </>
        )}

        {mode === 'automatic' && (
          <>
            <p className="text-subtle" style={{ fontSize: '0.78rem' }}>
              Picks a trending video that fits your niche, finds clips and sends them to your review queue. Nothing is published without you.
            </p>
            {rightsBox('I’ll only publish clips from videos I own or have permission to reuse.')}
            <button type="button" className="btn btn-primary" onClick={runAutomatic} disabled={busy || noPlan} style={{ alignSelf: 'flex-start' }}>
              {busy ? <RefreshCw size={14} className="animate-spin" /> : <Rocket size={14} />} Run automatic
            </button>
          </>
        )}

        {mode !== 'browse' && (
          <div>
            <button type="button" className="link-button text-subtle" style={{ fontSize: '0.75rem' }} aria-expanded={showOptions} onClick={() => setShowOptions((v) => !v)}>
              <ChevronDown size={12} style={{ transform: showOptions ? 'rotate(180deg)' : undefined }} /> Options · {LANGUAGES.find(([c]) => c === language)?.[1]} · {clipCount} clips · {captionStyle === 'Minimalist' ? 'clean captions' : 'bold captions'}
            </button>
            {showOptions && (
              <div className="options-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="opt-lang">Spoken language</label>
                  <select id="opt-lang" className="input-field" value={language} onChange={(e) => setLanguage(e.target.value)}>
                    {LANGUAGES.map(([c, l]) => <option key={c} value={c}>{l}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="opt-count">Clips to find</label>
                  <select id="opt-count" className="input-field" value={clipCount} onChange={(e) => setClipCount(Number(e.target.value))}>
                    {[3, 5, 7, 10].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="opt-style">Caption style</label>
                  <select id="opt-style" className="input-field" value={captionStyle} onChange={(e) => setCaptionStyle(e.target.value)}>
                    <option value="Dynamic Pop">Bold, 3 words at a time</option>
                    <option value="Minimalist">Clean lines</option>
                  </select>
                </div>
                <fieldset className="form-group" style={{ border: 0 }}>
                  <legend className="form-label">Write post captions for</legend>
                  <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                    {PLATFORMS.map(([id, label]) => (
                      <button key={id} type="button" aria-pressed={platforms.includes(id)} className={`filter-chip ${platforms.includes(id) ? 'active' : ''}`}
                        onClick={() => setPlatforms((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))}>{label}</button>
                    ))}
                  </div>
                </fieldset>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Projects ── */}
      {projects.length === 0 ? (
        <section className="panel empty-state">
          <Upload size={22} />
          <h3 className="section-title">Your projects will appear here</h3>
          <p className="text-muted" style={{ fontSize: '0.8125rem', maxWidth: 440 }}>
            Upload a recording above. We transcribe it, find the strongest standalone moments, and give you editable, captioned clips to download or publish.
          </p>
        </section>
      ) : (
        <div className="projects-layout">
          <nav className="panel-card project-list" aria-label="Projects">
            <h2 className="eyebrow" style={{ marginBottom: '0.5rem' }}>Projects · {projects.length}</h2>
            {projects.length > 4 && (
              <div className="list-search">
                <Search />
                <input value={projectQuery} onChange={(e) => setProjectQuery(e.target.value)} placeholder="Filter projects" aria-label="Filter projects" />
                {projectQuery && <button type="button" className="icon-btn" style={{ width: 20, height: 20 }} onClick={() => setProjectQuery('')} aria-label="Clear filter"><X size={12} /></button>}
              </div>
            )}
            <ul>
              {listed.length === 0 && <li className="text-subtle" style={{ fontSize: '0.75rem', padding: '0.5rem' }}>No match.</li>}
              {listed.map((p) => (
                <li key={p.id}>
                  <button type="button" className={`project-item ${selected?.id === p.id ? 'active' : ''}`} onClick={() => setSelectedId(p.id)} aria-current={selected?.id === p.id}>
                    <span className="truncate" style={{ fontWeight: 600, fontSize: '0.8rem' }}>{p.title}</span>
                    <span className="text-subtle" style={{ fontSize: '0.7rem', display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                      {PROCESSING.has(p.status) && <RefreshCw size={10} className="animate-spin" />}
                      {p.status === 'failed' ? <span style={{ color: 'var(--red)' }}>Failed</span> : PROCESSING.has(p.status) ? (p.stage || STATUS_TEXT[p.status]) : clipCountLabel(p.clips)}
                      {' · '}{fmtDate(p.createdAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {selected && (
            <section style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', minWidth: 0 }} aria-labelledby="project-title">
              <div className="panel-card" style={{ display: 'flex', gap: '0.9rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <h2 id="project-title" style={{ fontSize: '1rem', fontWeight: 650 }}>
                    <input
                      className="title-edit"
                      aria-label="Project title (click to rename)"
                      value={titleDraft ?? selected.title}
                      maxLength={200}
                      onChange={(e) => setTitleDraft(e.target.value)}
                      onBlur={renameProject}
                      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { setTitleDraft(null); (e.target as HTMLInputElement).blur(); } }}
                    />
                  </h2>
                  <p className="text-subtle" style={{ fontSize: '0.75rem' }}>
                    {selected.sourceType === 'youtube' ? 'YouTube' : selected.sourceType === 'transcript' ? 'Transcript' : 'Upload'}
                    {selected.duration ? ` · ${fmtTime(selected.duration)}` : ''}
                    {selected.language && selected.language !== 'auto' ? ` · ${LANGUAGES.find(([c]) => c === selected.language)?.[1] || selected.language}` : ''}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {selected.status === 'ready' && (
                    <button type="button" className="btn btn-secondary btn-sm" onClick={reanalyze} disabled={busy}><RefreshCw size={13} /> Find different clips</button>
                  )}
                  <button type="button" className="btn btn-ghost btn-sm" onClick={deleteProject} aria-label="Delete project"><Trash2 size={13} /> Delete</button>
                </div>
              </div>

              {PROCESSING.has(selected.status) && (
                <div className="panel-card processing" role="status" aria-live="polite" style={{ borderColor: 'var(--accent-line)' }}>
                  <RefreshCw size={16} className="animate-spin" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600, fontSize: '0.85rem' }}>{selected.stage || STATUS_TEXT[selected.status]}</p>
                    <p className="text-subtle" style={{ fontSize: '0.75rem', maxWidth: 560 }}>
                      {selected.status === 'transcribing'
                        ? 'Transcribing takes roughly a quarter of the recording’s length. You can close this page — progress is saved.'
                        : 'Reading the whole recording for standalone moments. Long recordings are processed in parts.'}
                    </p>
                    <div className="pipeline-bar" aria-hidden="true" />
                    <ol className="stage-list" aria-label="Processing steps">
                      {['Upload', 'Transcribe', 'Find clips', 'Review'].map((s, i) => {
                        const at = selected.status === 'transcribing' || selected.status === 'queued' ? 1 : 2;
                        return <li key={s} className={i < at ? 'done' : i === at ? 'current' : ''}>{s}</li>;
                      })}
                    </ol>
                  </div>
                </div>
              )}

              {selected.status === 'failed' && (
                <div className="notice notice-error" role="alert">
                  <AlertTriangle size={15} />
                  <span>{selected.errorMessage || 'Processing failed.'} {selected.clips.length === 0 && 'Your processing minutes for this recording were returned.'}</span>
                </div>
              )}

              {selected.clips.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <p className="text-subtle" style={{ fontSize: '0.75rem' }}>
                    Preview each moment, edit it if needed, then export. Download works without connecting any account.
                  </p>
                  {rejectedCount > 0 && (
                    <button type="button" className="link-button text-subtle" style={{ fontSize: '0.75rem' }} onClick={() => setClipFilter((f) => (f === 'all' ? 'active' : 'all'))}>
                      {clipFilter === 'all' ? 'Hide dismissed' : `Show ${rejectedCount} dismissed`}
                    </button>
                  )}
                </div>
              )}

              <div key={selected.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {clips.map((clip, i) => (
                  <ClipCard
                    key={clip.id}
                    clip={clip}
                    project={selected}
                    index={i}
                    channelConnected={data.channel.connected}
                    canRender={data.capabilities.videoExport}
                    onChange={updateClip}
                    onEdit={() => setEditing(clip.id)}
                    onGoToSettings={onGoToSettings}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {editing && selected && (
        <ClipEditor clipId={editing} projectId={selected.id} onClose={closeEditor} onSaved={updateClip} />
      )}
    </div>
  );
}
