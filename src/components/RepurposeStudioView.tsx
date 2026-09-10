"use client";

import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { ProjectData, ClipData } from '@/types';
import {
  Scissors, Copy, Check, Send, Sparkles, RefreshCw, Video, ExternalLink,
  AlertTriangle, FileText,
} from 'lucide-react';

interface Props {
  projects: ProjectData[];
  onRefresh: () => void;
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

function fmt(s: number): string {
  const t = Math.max(0, Math.floor(s));
  const m = Math.floor(t / 60);
  const sec = t % 60;
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}:${String(m % 60).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function parseCaptions(raw: ClipData['captionVersions']): Record<string, string> {
  if (raw && typeof raw === 'object') return raw as unknown as Record<string, string>;
  try {
    return JSON.parse(String(raw));
  } catch {
    return { instagram: String(raw || '') };
  }
}

export function RepurposeStudioView({ projects = [], onRefresh }: Props) {
  const [mode, setMode] = useState<'link' | 'transcript'>('link');
  const [url, setUrl] = useState('');
  const [transcript, setTranscript] = useState('');
  const [clipCount, setClipCount] = useState(5);
  const [busy, setBusy] = useState(false);

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

  const analyze = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (busy) return;
    const isLink = mode === 'link';
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
        body: JSON.stringify(isLink ? { sourceVideoUrl: url, clipCount } : { transcript, clipCount }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || 'Done', { id: 'an', duration: 4000 });
        setUrl('');
        setTranscript('');
        setSelectedProjectId(data.project.id);
        onRefresh();
      } else {
        toast.error(data.error || 'Analysis failed', { id: 'an', duration: 6000 });
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
        body: JSON.stringify({ projectId: activeProject.id, clipCount }),
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
      {/* Analyzer input */}
      <div className="panel-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="segmented-control">
            <button className={`segmented-item ${mode === 'link' ? 'active' : ''}`} onClick={() => setMode('link')}>
              <Video size={13} /> YouTube link
            </button>
            <button className={`segmented-item ${mode === 'transcript' ? 'active' : ''}`} onClick={() => setMode('transcript')}>
              <FileText size={13} /> Paste transcript
            </button>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span className="text-subtle" style={{ fontSize: '0.75rem' }}>Clips</span>
            <select className="input-field" style={{ width: 64 }} value={clipCount} onChange={(e) => setClipCount(Number(e.target.value))}>
              {[3, 5, 7, 10].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>

        <form onSubmit={analyze} style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          {mode === 'link' ? (
            <input
              className="input-field"
              style={{ flex: '1 1 320px' }}
              placeholder="https://www.youtube.com/watch?v=…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          ) : (
            <textarea
              className="input-field"
              style={{ flex: '1 1 100%', minHeight: 120 }}
              placeholder="Paste the full transcript here…"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
            />
          )}
          <button type="submit" className="btn btn-primary" disabled={busy} style={{ minWidth: 150 }}>
            {busy ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {busy ? 'Analyzing…' : 'Analyze'}
          </button>
        </form>
        <p className="text-subtle" style={{ fontSize: '0.75rem' }}>
          Viralis reads the video&apos;s captions, finds the highest-potential moments, and writes native copy for every platform.
          Cutting the actual MP4 runs on the media worker (not part of this deployment).
        </p>
      </div>

      {projects.length === 0 ? (
        <div className="panel" style={{ padding: '3.5rem 1.5rem', textAlign: 'center' }}>
          <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: 'var(--accent-subtle)', border: '1px solid var(--accent-line)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#b3a4f0', margin: '0 auto 0.85rem' }}>
            <Scissors size={20} />
          </div>
          <h3 className="section-title" style={{ marginBottom: '0.3rem' }}>Nothing analyzed yet</h3>
          <p className="text-muted" style={{ fontSize: '0.8125rem', maxWidth: 400, margin: '0 auto' }}>
            Paste a YouTube link above. You&apos;ll get ranked viral moments with exact timestamps and ready-to-post captions.
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
                      {PLATFORMS.map((p) => (
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
