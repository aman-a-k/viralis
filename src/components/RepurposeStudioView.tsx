"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { ProjectData, ClipData } from '@/types';
import {
  Scissors, Copy, Check, Send, Sparkles, RefreshCw, Video, ExternalLink,
  AlertTriangle, FileText, Radar, Smartphone, Square, Monitor, Eye, Rocket,
  Link2, Flame, Coffee, TrendingUp, BookOpen,
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

// Plain-language stand-ins for the analyzer's internal hook categories —
// creators shouldn't need to know what "contrarian" means.
const HOOK_LABELS: Record<string, string> = {
  contrarian: 'Surprising take',
  framework: 'Step-by-step',
  story: 'Story',
  data: 'Quick fact',
  question: 'Makes you think',
  howto: 'How-to',
  controversy: 'Hot take',
  insight: 'Insight',
};
const humanizeHook = (h?: string | null) => (h && HOOK_LABELS[h]) || 'Highlight';

type Vibe = 'hook' | 'calm' | 'trendy' | 'story';
const VIBE_LABEL: Record<Vibe, string> = { hook: 'Hook-heavy', calm: 'Calm & informative', trendy: 'Trendy & fast', story: 'Story-driven' };
const VIBE_ICON: Record<Vibe, React.ElementType> = { hook: Flame, calm: Coffee, trendy: TrendingUp, story: BookOpen };

const AUTOMATIC_STATUSES = [
  'Scanning what\'s trending…',
  'Picking the best fit for your niche…',
  'Reading the video…',
  'Finding the best moments…',
  'Writing captions…',
  'Sending clips to your queue…',
];

const TRANSCRIBING_STATUS = 'Transcribing the audio — this can take a few minutes for longer videos…';
const POLL_INTERVAL_MS = 6000;
const POLL_TIMEOUT_MS = 25 * 60 * 1000; // matches the worker's own job ceiling

interface TrendingVideo {
  videoId: string; url: string; title: string; channelTitle: string; thumbnail: string | null;
  viewCount: number; durationSeconds: number; vibe: Vibe;
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

function parseCaptions(raw: ClipData['captionVersions']): Record<string, string> {
  if (raw && typeof raw === 'object') return raw as unknown as Record<string, string>;
  try {
    return JSON.parse(String(raw));
  } catch {
    return { instagram: String(raw || '') };
  }
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

export function RepurposeStudioView({
  projects = [],
  onRefresh,
  defaultPlatforms,
  defaultOrientations,
  defaultCaptionStyle,
}: Props) {
  const [tab, setTab] = useState<'video' | 'transcript'>('video');
  const [mode, setMode] = useState<'automatic' | 'browse' | 'link'>('automatic');
  const [url, setUrl] = useState('');
  const [transcript, setTranscript] = useState('');
  const [clipCount, setClipCount] = useState(5);
  const [busy, setBusy] = useState(false);

  // Shared run configuration
  const [platforms, setPlatforms] = useState<string[]>(defaultPlatforms?.length ? defaultPlatforms : ['instagram', 'youtube', 'tiktok']);
  const [orientations, setOrientations] = useState<string[]>(defaultOrientations?.length ? defaultOrientations : [...ORIENTATIONS]);
  const [captionStyle, setCaptionStyleLocal] = useState<'Dynamic Pop' | 'Minimalist'>(
    defaultCaptionStyle === 'Minimalist' ? 'Minimalist' : 'Dynamic Pop'
  );

  // Trending discovery
  const [region, setRegion] = useState('US');
  const [category, setCategory] = useState('');
  const [vibeFilter, setVibeFilter] = useState<Vibe | 'all'>('all');
  const [trendingVideos, setTrendingVideos] = useState<TrendingVideo[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(false);
  const [automating, setAutomating] = useState(false);
  const [autoStatus, setAutoStatus] = useState(AUTOMATIC_STATUSES[0]);
  const [lastAutoResult, setLastAutoResult] = useState<{ title: string; channel: string; clipsCreated: number; clipsQueued: number } | null>(null);
  const statusTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [platform, setPlatform] = useState<Platform>('instagram');
  const [copiedKey, setCopiedKey] = useState<string>('');
  const [linkStatus, setLinkStatus] = useState('');

  const activeProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) || projects[0],
    [projects, selectedProjectId]
  );
  const clips = useMemo(
    () => [...(activeProject?.clips || [])].sort((a, b) => (b.viralityScore || 0) - (a.viralityScore || 0)),
    [activeProject]
  );

  useEffect(() => () => { if (statusTimer.current) clearInterval(statusTimer.current); }, []);

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

  // Auto-load trending videos the moment this tab is opened, instead of
  // making the user press "Find trending videos" first — the button then
  // doubles as a manual refresh (still honoring the region/category filters).
  useEffect(() => {
    if (mode === 'browse' && trendingVideos.length === 0 && !trendingLoading) {
      findTrending();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const visibleTrending = vibeFilter === 'all' ? trendingVideos : trendingVideos.filter((v) => v.vibe === vibeFilter);

  // "Add to generator" — feeds the trending pick straight into the analyzer
  // instead of just prefilling the link field.
  const addTrendingToGenerator = (v: TrendingVideo) => {
    setMode('link');
    setUrl(v.url);
    ingestLink(v.url);
  };

  const startStatusCycle = () => {
    let i = 0;
    setAutoStatus(AUTOMATIC_STATUSES[0]);
    statusTimer.current = setInterval(() => {
      i = Math.min(i + 1, AUTOMATIC_STATUSES.length - 1);
      setAutoStatus(AUTOMATIC_STATUSES[i]);
    }, 6000);
  };
  const stopStatusCycle = () => {
    if (statusTimer.current) clearInterval(statusTimer.current);
    statusTimer.current = null;
  };

  // Shared by both the automatic and manual-link flows: when the analyzer's
  // direct transcript fetch gets blocked by YouTube, ingestion falls back to
  // worker-side whisper.cpp transcription, which runs as a background job
  // (it can take far longer than any single request should wait on). This
  // polls until it finishes, fails, or we give up waiting.
  const pollProject = async (
    projectId: string,
    opts: { autoQueue?: boolean; onTick?: () => void } = {}
  ): Promise<
    | { ok: true; status: 'ready'; project: ProjectData; clips: ClipData[]; queued?: number }
    | { ok: true; status: 'failed'; error: string }
    | { ok: false; error: string }
  > => {
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      try {
        const res = await fetch('/api/repurpose/poll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, autoQueue: opts.autoQueue }),
        });
        const data = await res.json();
        if (!data.success) return { ok: false, error: data.error || 'Polling failed.' };
        if (data.status === 'transcribing') {
          opts.onTick?.();
          continue;
        }
        if (data.status === 'failed') {
          return { ok: true, status: 'failed', error: data.project?.errorMessage || 'Transcription failed.' };
        }
        return { ok: true, status: 'ready', project: data.project, clips: data.clips, queued: data.queued };
      } catch {
        // transient network error mid-poll — keep trying until the deadline
      }
    }
    return { ok: false, error: 'This is taking longer than expected. Check back in a few minutes — it may still finish in the background.' };
  };

  const runAutomatic = async () => {
    setAutomating(true);
    setLastAutoResult(null);
    startStatusCycle();
    try {
      const res = await fetch('/api/trends/automate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...runConfig(), region, category: category || undefined }),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(data.error || 'Automatic run failed.', { duration: 8000 });
        return;
      }

      if (data.result.transcribing) {
        stopStatusCycle();
        setAutoStatus(TRANSCRIBING_STATUS);
        const polled = await pollProject(data.result.projectId, { autoQueue: true });
        if (!polled.ok || polled.status === 'failed') {
          toast.error((!polled.ok ? polled.error : polled.error) || 'Transcription failed.', { duration: 8000 });
          onRefresh();
          return;
        }
        toast.success('Done — clips are in your Approval Queue.', { duration: 5000 });
        setLastAutoResult({
          title: polled.project.title,
          channel: polled.project.channel || '',
          clipsCreated: polled.clips.length,
          clipsQueued: polled.queued ?? polled.clips.length,
        });
        setSelectedProjectId(polled.project.id);
        onRefresh();
        return;
      }

      toast.success('Done — clips are in your Approval Queue.', { duration: 5000 });
      setLastAutoResult({
        title: data.result.video.title,
        channel: data.result.video.channelTitle,
        clipsCreated: data.result.clipsCreated,
        clipsQueued: data.result.clipsQueued,
      });
      setSelectedProjectId(data.result.projectId);
      onRefresh();
    } catch {
      toast.error('Network error running automatic discovery.');
    } finally {
      stopStatusCycle();
      setAutomating(false);
    }
  };

  // Shared by the "Paste a link" form and the trending cards' "Add to
  // generator" button — both just feed a YouTube URL into the same pipeline.
  const ingestLink = async (videoUrl: string) => {
    if (busy) return;
    if (!/youtube\.com|youtu\.be/.test(videoUrl)) {
      toast.error('Paste a valid YouTube link.');
      return;
    }

    setBusy(true);
    setLinkStatus('');
    toast.loading('Reading the video & finding highlights…', { id: 'an' });
    try {
      const res = await fetch('/api/repurpose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceVideoUrl: videoUrl, ...runConfig() }),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(data.error || 'Analysis failed', { id: 'an', duration: 7000 });
        onRefresh();
        return;
      }

      setUrl('');
      setSelectedProjectId(data.project.id);
      onRefresh();

      if (data.transcribing) {
        toast.loading(data.message || TRANSCRIBING_STATUS, { id: 'an' });
        setLinkStatus(TRANSCRIBING_STATUS);
        const polled = await pollProject(data.project.id, { autoQueue: false });
        if (!polled.ok || polled.status === 'failed') {
          toast.error((!polled.ok ? polled.error : polled.error) || 'Transcription failed.', { id: 'an', duration: 8000 });
          onRefresh();
          return;
        }
        toast.success(`Analyzed "${polled.project.title}" — surfaced ${polled.clips.length} clips.`, { id: 'an', duration: 4000 });
        onRefresh();
        return;
      }

      toast.success(data.message || 'Done', { id: 'an', duration: 4000 });
    } catch {
      toast.error('Network error contacting the analyzer.', { id: 'an' });
    } finally {
      setBusy(false);
      setLinkStatus('');
    }
  };

  const analyze = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (busy) return;

    if (tab === 'video') {
      await ingestLink(url);
      return;
    }

    if (transcript.trim().length < 200) {
      toast.error('Paste a transcript of at least ~200 characters.');
      return;
    }

    setBusy(true);
    toast.loading('Analyzing transcript…', { id: 'an' });
    try {
      const res = await fetch('/api/repurpose/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, ...runConfig() }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || 'Done', { id: 'an', duration: 4000 });
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
    toast.loading('Sending to queue…', { id: 'q' });
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

  // One-shot check for a project that's stuck showing "transcribing" after a
  // page refresh (the active poll loop only lives for the tab that started
  // it) — lets the user manually pull the latest status instead of waiting.
  const checkTranscription = async (projectId: string) => {
    toast.loading('Checking…', { id: 'chk' });
    try {
      const res = await fetch('/api/repurpose/poll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(data.error || 'Check failed.', { id: 'chk' });
        return;
      }
      if (data.status === 'transcribing') toast('Still transcribing — check back shortly.', { id: 'chk' });
      else if (data.status === 'failed') toast.error(data.project?.errorMessage || 'Transcription failed.', { id: 'chk' });
      else toast.success(`Ready — ${data.clips?.length || 0} clips.`, { id: 'chk' });
      onRefresh();
    } catch {
      toast.error('Network error.', { id: 'chk' });
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
      `Style: ${humanizeHook(clip.hookType)} · Virality: ${clip.viralityScore}/100`,
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
      <div className="panel-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div className="segmented-control">
          <button className={`segmented-item ${tab === 'video' ? 'active' : ''}`} onClick={() => setTab('video')}>
            <Video size={13} /> Add a video
          </button>
          <button className={`segmented-item ${tab === 'transcript' ? 'active' : ''}`} onClick={() => setTab('transcript')}>
            <FileText size={13} /> Paste a transcript
          </button>
        </div>

        {tab === 'video' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div className="segmented-control" style={{ alignSelf: 'flex-start' }}>
              <button className={`segmented-item ${mode === 'automatic' ? 'active' : ''}`} onClick={() => setMode('automatic')}>
                <Rocket size={13} /> Automatic
              </button>
              <button className={`segmented-item ${mode === 'browse' ? 'active' : ''}`} onClick={() => setMode('browse')}>
                <Radar size={13} /> Browse trending
              </button>
              <button className={`segmented-item ${mode === 'link' ? 'active' : ''}`} onClick={() => setMode('link')}>
                <Link2 size={13} /> Paste a link
              </button>
            </div>

            {mode === 'automatic' && (
              <>
                <p className="text-muted" style={{ fontSize: '0.8125rem' }}>
                  One click. Viralis finds a trending video that fits your niche, analyzes it, writes the captions, and sends every clip straight to your <strong>Approval Queue</strong> — nothing else to do.
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <select className="input-field" style={{ width: 160 }} value={region} onChange={(e) => setRegion(e.target.value)}>
                    {REGIONS.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
                  </select>
                  <select className="input-field" style={{ width: 180 }} value={category} onChange={(e) => setCategory(e.target.value)}>
                    {CATEGORIES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                  </select>
                  <button type="button" className="btn btn-primary" onClick={runAutomatic} disabled={automating}>
                    {automating ? <RefreshCw size={14} className="animate-spin" /> : <Rocket size={14} />}
                    {automating ? autoStatus : 'Run automatic'}
                  </button>
                </div>
                {automating && (
                  <p className="text-subtle" style={{ fontSize: '0.75rem' }}>Usually 20–60 seconds, longer for long videos.</p>
                )}

                {lastAutoResult && (
                  <div className="panel-card" style={{ background: 'var(--bg-elevated)', display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
                    <Check size={16} style={{ color: 'var(--green)', flexShrink: 0, marginTop: 2 }} />
                    <div style={{ fontSize: '0.8125rem' }}>
                      <strong>{lastAutoResult.title}</strong> <span className="text-subtle">· {lastAutoResult.channel}</span>
                      <p className="text-muted" style={{ marginTop: '0.2rem' }}>
                        {lastAutoResult.clipsCreated} clips ready, already sent to your Approval Queue.
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}

            {mode === 'browse' && (
              <>
                <p className="text-subtle" style={{ fontSize: '0.75rem' }}>
                  See what&apos;s trending, filter by the style you want, pick one, then tune the details before analyzing.
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <select className="input-field" style={{ width: 160 }} value={region} onChange={(e) => setRegion(e.target.value)}>
                    {REGIONS.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
                  </select>
                  <select className="input-field" style={{ width: 180 }} value={category} onChange={(e) => setCategory(e.target.value)}>
                    {CATEGORIES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                  </select>
                  <button type="button" className="btn btn-secondary" onClick={findTrending} disabled={trendingLoading}>
                    {trendingLoading ? <RefreshCw size={14} className="animate-spin" /> : <Radar size={14} />}
                    {trendingLoading ? 'Finding…' : trendingVideos.length > 0 ? 'Refresh' : 'Find trending videos'}
                  </button>
                </div>

                {trendingVideos.length > 0 && (
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                    <button className={`filter-chip ${vibeFilter === 'all' ? 'active' : ''}`} onClick={() => setVibeFilter('all')}>All</button>
                    {(['hook', 'calm', 'trendy', 'story'] as Vibe[]).map((v) => {
                      const Icon = VIBE_ICON[v];
                      return (
                        <button key={v} className={`filter-chip ${vibeFilter === v ? 'active' : ''}`} onClick={() => setVibeFilter(v)}>
                          <Icon size={12} /> {VIBE_LABEL[v]}
                        </button>
                      );
                    })}
                  </div>
                )}

                {mode === 'browse' && trendingVideos.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem' }}>
                    {visibleTrending.map((v) => {
                      const VibeIcon = VIBE_ICON[v.vibe];
                      return (
                        <div key={v.videoId} className="panel-card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                          <div style={{ position: 'relative', height: 120, background: 'var(--bg-elevated)' }}>
                            {v.thumbnail && (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img src={v.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            )}
                            <span style={{ position: 'absolute', bottom: 6, right: 6, background: 'rgba(0,0,0,0.75)', color: '#fff', fontSize: '0.6875rem', padding: '0.1rem 0.35rem', borderRadius: 4 }}>
                              {fmt(v.durationSeconds)}
                            </span>
                            <span style={{ position: 'absolute', top: 6, left: 6, background: 'rgba(0,0,0,0.75)', color: '#fff', fontSize: '0.65rem', padding: '0.1rem 0.4rem', borderRadius: 4, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <VibeIcon size={10} /> {VIBE_LABEL[v.vibe]}
                            </span>
                          </div>
                          <div style={{ padding: '0.65rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.3rem', flex: 1 }}>
                            <h4 style={{ fontSize: '0.78125rem', fontWeight: 600, lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{v.title}</h4>
                            <p className="text-subtle" style={{ fontSize: '0.7rem' }}>{v.channelTitle}</p>
                            <p className="text-subtle" style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                              <Eye size={11} /> {fmtViews(v.viewCount)}
                            </p>
                            <div style={{ display: 'flex', gap: '0.4rem', marginTop: 'auto', paddingTop: '0.3rem' }}>
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                style={{ flex: 1, fontSize: '0.7rem' }}
                                disabled={busy}
                                onClick={() => addTrendingToGenerator(v)}
                              >
                                <Sparkles size={12} /> Add to generator
                              </button>
                              <a
                                href={v.url}
                                target="_blank"
                                rel="noreferrer"
                                className="btn btn-secondary btn-sm"
                                style={{ fontSize: '0.7rem' }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Video size={12} /> Watch
                              </a>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {mode === 'link' && (
              <>
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
                {linkStatus && (
                  <p className="text-subtle" style={{ fontSize: '0.75rem' }}>{linkStatus}</p>
                )}
              </>
            )}
          </div>
        )}

        {tab === 'transcript' && (
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

        {/* SHARED RUN CONFIG — hidden for the zero-click automatic path */}
        {!(tab === 'video' && mode === 'automatic') && (
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <span className="eyebrow">Before you analyze</span>
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <span className="text-subtle" style={{ fontSize: '0.72rem', fontWeight: 600 }}>Post to</span>
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  {PLATFORMS.map((p) => (
                    <button key={p} type="button" onClick={() => togglePlatform(p)} className={`filter-chip ${platforms.includes(p) ? 'active' : ''}`}>
                      {PLATFORM_LABEL[p]}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <span className="text-subtle" style={{ fontSize: '0.72rem', fontWeight: 600 }}>Shape</span>
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
                <span className="text-subtle" style={{ fontSize: '0.72rem', fontWeight: 600 }}>Caption feel</span>
                <div className="segmented-control">
                  <button type="button" className={`segmented-item ${captionStyle === 'Dynamic Pop' ? 'active' : ''}`} onClick={() => setCaptionStyleLocal('Dynamic Pop')}>Punchy</button>
                  <button type="button" className={`segmented-item ${captionStyle === 'Minimalist' ? 'active' : ''}`} onClick={() => setCaptionStyleLocal('Minimalist')}>Clean</button>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <span className="text-subtle" style={{ fontSize: '0.72rem', fontWeight: 600 }}>How many clips</span>
                <select className="input-field" style={{ width: 72 }} value={clipCount} onChange={(e) => setClipCount(Number(e.target.value))}>
                  {[3, 5, 7, 10].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>
            <p className="text-subtle" style={{ fontSize: '0.72rem' }}>Fewer platforms and clips means a faster result.</p>
          </div>
        )}
      </div>

      {projects.length === 0 ? (
        <div className="panel" style={{ padding: '3.5rem 1.5rem', textAlign: 'center' }}>
          <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: 'var(--accent-subtle)', border: '1px solid var(--accent-line)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#b3a4f0', margin: '0 auto 0.85rem' }}>
            <Scissors size={20} />
          </div>
          <h3 className="section-title" style={{ marginBottom: '0.3rem' }}>Nothing analyzed yet</h3>
          <p className="text-muted" style={{ fontSize: '0.8125rem', maxWidth: 420, margin: '0 auto' }}>
            Try Automatic above for the fastest start, or browse trending videos and pick one yourself.
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
                {activeProject?.status === 'transcribing' ? 'Transcribing…' : `${clips.length} clips`}
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

          {activeProject?.status === 'transcribing' && (
            <div className="panel-card" style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
              <RefreshCw size={16} className="animate-spin" style={{ flexShrink: 0 }} />
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-2)', flex: 1 }}>
                Transcribing the audio — this can take a few minutes for longer videos.
              </p>
              <button className="btn btn-secondary btn-sm" onClick={() => checkTranscription(activeProject.id)}>
                Check now
              </button>
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
              const queued = clip.status === 'approved';
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
                        <span className="badge badge-primary">{humanizeHook(clip.hookType)}</span>
                        {queued && <span className="badge badge-success"><Check size={10} /> In queue</span>}
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
                    {!queued && (
                      <button className="btn btn-primary btn-sm" onClick={() => queueClip(clip.id)}>
                        <Send size={13} /> Send to queue
                      </button>
                    )}
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
