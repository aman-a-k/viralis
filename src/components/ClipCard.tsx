"use client";

import React, { useState } from 'react';
import toast from 'react-hot-toast';
import {
  Check, Copy, Download, Film, Pencil, RefreshCw, Send, AlertTriangle, MonitorUp, Captions, Play, Undo2, XCircle, ExternalLink,
} from 'lucide-react';
import type { ClipData, ProjectData } from '@/types';
import { humanizeHook } from '@/lib/hookLabels';
import { api, errorMessage, fmtTime } from '@/lib/client';
import { ScoreRing } from './motion';

const PLATFORMS = ['youtube', 'instagram', 'tiktok', 'linkedin', 'twitter'] as const;
const PLATFORM_LABEL: Record<string, string> = { instagram: 'Instagram', youtube: 'YouTube', linkedin: 'LinkedIn', twitter: 'X', tiktok: 'TikTok' };
const ASPECTS = ['9:16', '1:1', '16:9'];

interface Props {
  clip: ClipData;
  project: ProjectData;
  index: number;
  channelConnected: boolean;
  /** False when the media worker isn't configured on this deployment. */
  canRender?: boolean;
  onChange: (clip: ClipData) => void;
  onEdit: () => void;
  onGoToSettings: () => void;
}

const STATUS_BADGE: Record<string, [string, string]> = {
  candidate: ['badge-neutral', 'Suggested'],
  in_review: ['badge-warning', 'In review'],
  approved: ['badge-success', 'Approved'],
  published: ['badge-success', 'Published'],
  rejected: ['badge-danger', 'Rejected'],
};

export function ClipCard({ clip, project, index, channelConnected, canRender = true, onChange, onEdit, onGoToSettings }: Props) {
  const [platform, setPlatform] = useState<string>(PLATFORMS.find((p) => clip.captionVersions[p]) || 'youtube');
  const [aspect, setAspect] = useState(clip.renderedAspect || '9:16');
  const [privacy, setPrivacy] = useState<'unlisted' | 'private' | 'public'>('unlisted');
  const [busy, setBusy] = useState<string>('');
  const [showSource, setShowSource] = useState(false);
  const [copied, setCopied] = useState(false);

  const canExport = project.sourceType !== 'transcript' && canRender;
  const working = clip.renderStatus === 'queued' || clip.renderStatus === 'rendering';
  const [badgeClass, badgeLabel] = STATUS_BADGE[clip.status] || STATUS_BADGE.candidate;

  const run = async (key: string, fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(key);
    try {
      await fn();
    } catch (err) {
      toast.error(errorMessage(err), { duration: 8000 });
    } finally {
      setBusy('');
    }
  };

  const patch = (body: Record<string, unknown>, msg: string) =>
    run(String(body.action), async () => {
      const res = await api<{ clip: ClipData }>(`/api/clips/${clip.id}`, { method: 'PATCH', body });
      onChange(res.clip);
      toast.success(msg);
    });

  const exportClip = () =>
    run('export', async () => {
      const res = await api<{ clip: ClipData }>('/api/repurpose/render', { body: { clipId: clip.id, aspectRatio: aspect } });
      onChange(res.clip);
      toast.success('Export started. It usually takes a few minutes — you can leave this page.');
    });

  const publish = () =>
    run('publish', async () => {
      toast.loading('Uploading to YouTube…', { id: `pub-${clip.id}` });
      try {
        const res = await api<{ postUrl: string }>('/api/repurpose/publish', { body: { clipId: clip.id, privacy } });
        toast.success('Published to YouTube.', { id: `pub-${clip.id}` });
        onChange({ ...clip, status: 'published', publish: { status: 'published', postUrl: res.postUrl, error: null } });
      } catch (err) {
        toast.dismiss(`pub-${clip.id}`);
        throw err;
      }
    });

  const copyCaption = async () => {
    await navigator.clipboard.writeText(clip.captionVersions[platform as keyof typeof clip.captionVersions] || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const published = clip.publish?.status === 'published' && clip.publish.postUrl;
  const textOnly = project.sourceType === 'transcript' && !clip.hasRender;

  return (
    <article className={`panel-card clip-card spot ${textOnly ? 'text-only' : ''}`} aria-labelledby={`clip-${clip.id}-title`} style={{ animationDelay: `${Math.min(index, 6) * 60}ms` }}>
      {!textOnly && <div className="clip-card-media">
        {clip.hasRender && clip.renderStatus !== 'expired' ? (
          <video src={`/api/media/clip/${clip.id}`} controls preload="none" className="clip-video" aria-label={`Exported video: ${clip.title}`} />
        ) : showSource && project.sourceType === 'youtube' && project.sourceVideoId ? (
          <iframe
            className="clip-video"
            title={`Source moment: ${clip.title}`}
            src={`https://www.youtube-nocookie.com/embed/${project.sourceVideoId}?start=${Math.floor(clip.startTime)}&end=${Math.ceil(clip.endTime)}&autoplay=1&rel=0`}
            allow="autoplay; encrypted-media"
          />
        ) : showSource && project.hasSourceMedia ? (
          <video src={`/api/media/source/${project.id}#t=${clip.startTime},${clip.endTime}`} controls autoPlay className="clip-video" />
        ) : (
          <button type="button" className="clip-video clip-placeholder" onClick={() => setShowSource(true)} disabled={project.sourceType === 'transcript'}>
            {project.sourceType === 'transcript' ? (
              <span className="text-subtle" style={{ fontSize: '0.75rem' }}>Text-only project</span>
            ) : (
              <>
                <Play size={22} />
                <span style={{ fontSize: '0.75rem' }}>Preview moment</span>
              </>
            )}
          </button>
        )}
      </div>}

      <div className="clip-card-body">
        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="text-subtle tnum" style={{ fontSize: '0.72rem' }}>#{index + 1}</span>
          <span className={`badge ${badgeClass}`}>{badgeLabel}</span>
          <span className="badge badge-neutral tnum">{fmtTime(clip.startTime)}–{fmtTime(clip.endTime)} · {clip.duration}s</span>
          <span className="badge badge-neutral">{humanizeHook(clip.hookType)}</span>
          {clip.edited && <span className="badge badge-neutral">Edited</span>}
          {working && <span className="badge badge-warning"><RefreshCw size={10} className="animate-spin" /> Exporting…</span>}
          {clip.renderStatus === 'stale' && <span className="badge badge-warning">Edits not exported yet</span>}
          {clip.renderStatus === 'expired' && <span className="badge badge-neutral">Export deleted (retention)</span>}
        </div>
        <div className="clip-head">
          <ScoreRing value={clip.viralityScore} />
          <div style={{ minWidth: 0 }}>
            <h3 id={`clip-${clip.id}-title`} style={{ fontSize: '0.95rem', fontWeight: 650, lineHeight: 1.35 }}>{clip.title}</h3>
            {clip.reasoning && <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.2rem' }}>{clip.reasoning}</p>}
          </div>
        </div>
        {textOnly && <p className="text-subtle" style={{ fontSize: '0.72rem' }}>From a pasted transcript — cut this moment from your own video using the timestamps, and download its captions.</p>}

        <details>
          <summary className="text-subtle" style={{ fontSize: '0.75rem', cursor: 'pointer' }}>What’s said in this clip</summary>
          <p className="quote-box">“{clip.transcriptSegment}”</p>
        </details>

        <details>
          <summary className="text-subtle" style={{ fontSize: '0.75rem', cursor: 'pointer' }}>Post captions</summary>
          <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', margin: '0.5rem 0' }} role="tablist" aria-label="Platform">
            {PLATFORMS.filter((p) => clip.captionVersions[p]).map((p) => (
              <button key={p} type="button" role="tab" aria-selected={platform === p} className={`filter-chip ${platform === p ? 'active' : ''}`} onClick={() => setPlatform(p)}>
                {PLATFORM_LABEL[p]}
              </button>
            ))}
          </div>
          <div style={{ position: 'relative' }}>
            <textarea readOnly className="input-field" aria-label={`${PLATFORM_LABEL[platform]} caption`} style={{ minHeight: 90, fontSize: '0.8rem', paddingRight: '2.5rem' }} value={clip.captionVersions[platform as keyof typeof clip.captionVersions] || '—'} />
            <button type="button" className="icon-btn" style={{ position: 'absolute', top: 6, right: 6 }} onClick={copyCaption} aria-label="Copy caption">
              {copied ? <Check size={14} color="var(--green)" /> : <Copy size={14} />}
            </button>
          </div>
        </details>

        {clip.renderStatus === 'failed' && clip.renderError && (
          <p className="inline-error" role="alert"><AlertTriangle size={13} /> Export failed: {clip.renderError}</p>
        )}
        {clip.publish?.status === 'failed' && clip.publish.error && (
          <p className="inline-error" role="alert"><AlertTriangle size={13} /> Publish failed: {clip.publish.error}</p>
        )}

        <div className="clip-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onEdit}><Pencil size={13} /> Edit</button>

          {canExport && clip.status !== 'rejected' && (
            <span className="action-group">
              <select className="input-field select-sm" aria-label="Export shape" value={aspect} disabled={working} onChange={(e) => setAspect(e.target.value)}>
                {ASPECTS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
              <button type="button" className="btn btn-primary btn-sm" onClick={exportClip} disabled={working || !!busy}>
                {working || busy === 'export' ? <RefreshCw size={13} className="animate-spin" /> : <Film size={13} />}
                {working ? 'Exporting…' : clip.hasRender && clip.renderStatus !== 'expired' ? 'Export again' : 'Export video'}
              </button>
            </span>
          )}

          {clip.hasRender && clip.renderStatus !== 'expired' && (
            <a className="btn btn-secondary btn-sm" href={`/api/media/clip/${clip.id}`} target="_blank" rel="noreferrer"><Download size={13} /> Download</a>
          )}
          <a className="btn btn-ghost btn-sm" href={`/api/clips/${clip.id}/captions?format=srt`}><Captions size={13} /> Captions (.srt)</a>

          {clip.status === 'candidate' && (
            <>
              <button type="button" className="btn btn-secondary btn-sm" disabled={!!busy} onClick={() => patch({ action: 'send_to_review' }, 'Sent to review.')}><Send size={13} /> Send to review</button>
              <button type="button" className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => patch({ action: 'reject' }, 'Clip dismissed.')}><XCircle size={13} /> Dismiss</button>
            </>
          )}
          {clip.status === 'rejected' && (
            <button type="button" className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => patch({ action: 'restore' }, 'Clip restored.')}><Undo2 size={13} /> Restore</button>
          )}
        </div>

        {published ? (
          <a href={clip.publish!.postUrl!} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }}>
            <Check size={13} color="var(--green)" /> Live on YouTube <ExternalLink size={12} />
          </a>
        ) : clip.status === 'approved' && clip.hasRender && clip.renderStatus !== 'expired' ? (
          channelConnected ? (
            <span className="action-group">
              <select className="input-field select-sm" aria-label="YouTube visibility" value={privacy} onChange={(e) => setPrivacy(e.target.value as typeof privacy)}>
                <option value="unlisted">Unlisted</option>
                <option value="private">Private</option>
                <option value="public">Public</option>
              </select>
              <button type="button" className="btn btn-primary btn-sm" disabled={!!busy || working} onClick={publish}>
                {busy === 'publish' ? <RefreshCw size={13} className="animate-spin" /> : <MonitorUp size={13} />} Publish to YouTube
              </button>
            </span>
          ) : (
            <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={onGoToSettings}>
              <MonitorUp size={13} /> Connect YouTube to publish (optional)
            </button>
          )
        ) : null}
      </div>
    </article>
  );
}
