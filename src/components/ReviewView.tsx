"use client";

import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { CheckCircle, XCircle, Inbox, Lightbulb, RefreshCw, Clock } from 'lucide-react';
import type { ApprovalItem, DashboardData } from '@/types';
import { api, errorMessage, fmtTime } from '@/lib/client';

interface Props {
  data: DashboardData;
  onRefresh: () => void;
}

const parse = <T,>(s: string | null | undefined, fallback: T): T => {
  try {
    return s ? (JSON.parse(s) as T) : fallback;
  } catch {
    return fallback;
  }
};

export function ReviewView({ data, onRefresh }: Props) {
  const [tab, setTab] = useState<'clips' | 'ideas'>('clips');
  const [busy, setBusy] = useState('');
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [writing, setWriting] = useState(false);

  const clipsById = useMemo(() => {
    const map = new Map<string, { clip: DashboardData['projects'][number]['clips'][number]; project: DashboardData['projects'][number] }>();
    for (const project of data.projects) for (const clip of project.clips) map.set(clip.id, { clip, project });
    return map;
  }, [data.projects]);

  const clipItems = data.approvalQueue.filter((i) => i.clipId);
  const ideaItems = data.approvalQueue.filter((i) => !i.clipId);

  const decide = async (item: ApprovalItem, action: 'approve' | 'reject') => {
    setBusy(item.id);
    try {
      const res = await api<{ message: string }>('/api/approval', { body: { id: item.id, action, reason: action === 'reject' ? reason : undefined } });
      toast.success(res.message, { duration: 6000 });
      setRejecting(null);
      setReason('');
      onRefresh();
    } catch (err) {
      toast.error(errorMessage(err), { duration: 8000 });
    } finally {
      setBusy('');
    }
  };

  const writeIdea = async () => {
    setWriting(true);
    try {
      const res = await api<{ message: string }>('/api/trigger', { method: 'POST', body: {} });
      toast.success(res.message, { duration: 6000 });
      onRefresh();
    } catch (err) {
      toast.error(errorMessage(err), { duration: 8000 });
    } finally {
      setWriting(false);
    }
  };

  const actions = (item: ApprovalItem, approveLabel: string) =>
    rejecting === item.id ? (
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <label className="sr-only" htmlFor={`reason-${item.id}`}>Reason (optional)</label>
        <input id={`reason-${item.id}`} className="input-field" style={{ flex: '1 1 200px' }} placeholder="What’s wrong with it? (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
        <button type="button" className="btn btn-danger btn-sm" disabled={busy === item.id} onClick={() => decide(item, 'reject')}>Reject</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRejecting(null)}>Cancel</button>
      </div>
    ) : (
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-primary btn-sm" disabled={busy === item.id} onClick={() => decide(item, 'approve')}>
          {busy === item.id ? <RefreshCw size={13} className="animate-spin" /> : <CheckCircle size={13} />} {approveLabel}
        </button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setRejecting(item.id)}><XCircle size={13} /> Reject</button>
      </div>
    );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="segmented-control" role="tablist" aria-label="Review" style={{ alignSelf: 'flex-start' }}>
        <button type="button" role="tab" aria-selected={tab === 'clips'} className={`segmented-item ${tab === 'clips' ? 'active' : ''}`} onClick={() => setTab('clips')}>
          <Inbox size={13} /> Clips {clipItems.length > 0 && <span className="badge badge-warning">{clipItems.length}</span>}
        </button>
        <button type="button" role="tab" aria-selected={tab === 'ideas'} className={`segmented-item ${tab === 'ideas' ? 'active' : ''}`} onClick={() => setTab('ideas')}>
          <Lightbulb size={13} /> Script ideas {ideaItems.length > 0 && <span className="badge badge-neutral">{ideaItems.length}</span>}
        </button>
      </div>

      {tab === 'clips' && (
        clipItems.length === 0 ? (
          <section className="panel empty-state">
            <Inbox size={22} />
            <h3 className="section-title">Nothing waiting for review</h3>
            <p className="text-muted" style={{ fontSize: '0.8125rem', maxWidth: 440 }}>
              Send clips here from a project when they’re ready for a second look. Approving a clip exports it (if it isn’t already) and makes it publishable.
            </p>
          </section>
        ) : (
          clipItems.map((item) => {
            const found = item.clipId ? clipsById.get(item.clipId) : undefined;
            const clip = found?.clip;
            const project = found?.project;
            return (
              <article key={item.id} className="panel-card review-card">
                <div className="review-media">
                  {clip?.hasRender ? (
                    <video src={`/api/media/clip/${clip.id}`} controls preload="none" className="clip-video" />
                  ) : project?.sourceType === 'youtube' && project.sourceVideoId && clip ? (
                    <iframe className="clip-video" title={`Preview: ${item.topic}`} loading="lazy"
                      src={`https://www.youtube-nocookie.com/embed/${project.sourceVideoId}?start=${Math.floor(clip.startTime)}&end=${Math.ceil(clip.endTime)}&rel=0`} />
                  ) : project?.hasSourceMedia && clip ? (
                    <video src={`/api/media/source/${project.id}#t=${clip.startTime},${clip.endTime}`} controls preload="none" className="clip-video" />
                  ) : (
                    <div className="clip-video clip-placeholder"><span className="text-subtle" style={{ fontSize: '0.75rem' }}>No preview</span></div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', minWidth: 0 }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 650 }}>{item.topic}</h3>
                  <p className="text-subtle" style={{ fontSize: '0.72rem' }}>
                    {project?.title}{clip ? ` · ${fmtTime(clip.startTime)}–${fmtTime(clip.endTime)}` : ''} · <Clock size={10} /> {new Date(item.createdAt).toLocaleString()}
                  </p>
                  {item.seoTitle && <p style={{ fontSize: '0.8rem' }}><strong>Title:</strong> {item.seoTitle}</p>}
                  <details>
                    <summary className="text-subtle" style={{ fontSize: '0.75rem', cursor: 'pointer' }}>What’s said</summary>
                    <p className="quote-box">“{item.script}”</p>
                  </details>
                  {item.seoDescription && (
                    <details>
                      <summary className="text-subtle" style={{ fontSize: '0.75rem', cursor: 'pointer' }}>Description</summary>
                      <p className="quote-box" style={{ whiteSpace: 'pre-wrap' }}>{item.seoDescription}</p>
                    </details>
                  )}
                  {actions(item, clip?.hasRender ? 'Approve' : 'Approve & export')}
                </div>
              </article>
            );
          })
        )
      )}

      {tab === 'ideas' && (
        <>
          <div className="panel-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <p className="text-muted" style={{ fontSize: '0.8125rem', maxWidth: 560 }}>
              Short-video scripts written from today’s trends in your niche — for you to record. Viralis doesn’t generate the video itself.
            </p>
            <button type="button" className="btn btn-secondary" onClick={writeIdea} disabled={writing}>
              {writing ? <RefreshCw size={14} className="animate-spin" /> : <Lightbulb size={14} />} Write a script idea
            </button>
          </div>
          {ideaItems.length === 0 ? (
            <section className="panel empty-state"><Lightbulb size={22} /><p className="text-muted" style={{ fontSize: '0.8125rem' }}>No script ideas waiting.</p></section>
          ) : (
            ideaItems.map((item) => {
              const tags = parse<string[]>(item.seoTags, []);
              const scenes = parse<{ spokenText?: string; bRollPrompt?: string }[]>(item.visualPrompts, []);
              return (
                <article key={item.id} className="panel-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 650 }}>{item.seoTitle || item.topic}</h3>
                  <p className="text-subtle" style={{ fontSize: '0.72rem' }}>Topic: {item.topic}</p>
                  <p className="quote-box" style={{ whiteSpace: 'pre-wrap' }}>{item.script}</p>
                  {scenes.length > 0 && (
                    <details>
                      <summary className="text-subtle" style={{ fontSize: '0.75rem', cursor: 'pointer' }}>Shot list ({scenes.length})</summary>
                      <ol style={{ paddingLeft: '1.2rem', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.4rem' }}>
                        {scenes.map((s, i) => <li key={i}>{s.spokenText}{s.bRollPrompt && <span className="text-subtle"> — show: {s.bRollPrompt}</span>}</li>)}
                      </ol>
                    </details>
                  )}
                  {tags.length > 0 && <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>{tags.map((t) => <span key={t} className="badge badge-neutral">#{t}</span>)}</div>}
                  {actions(item, 'Keep')}
                </article>
              );
            })
          )}
        </>
      )}
    </div>
  );
}
