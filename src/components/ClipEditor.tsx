"use client";

import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { X, Save, RefreshCw, Crosshair, Play } from 'lucide-react';
import type { ClipData } from '@/types';
import { api, errorMessage, fmtPrecise, parseTime } from '@/lib/client';

interface Props {
  clipId: string;
  projectId: string;
  onClose: () => void;
  onSaved: (clip: ClipData) => void;
}

interface EditorPayload {
  clip: ClipData;
  words: { w: string; s: number; e: number }[];
  projectDuration: number | null;
  source: { kind: 'youtube'; videoId: string | null } | { kind: 'file' } | { kind: 'none' };
}

type Tab = 'trim' | 'captions' | 'framing' | 'publish';

export function ClipEditor({ clipId, projectId, onClose, onSaved }: Props) {
  const [data, setData] = useState<EditorPayload | null>(null);
  const [tab, setTab] = useState<Tab>('trim');
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [captionText, setCaptionText] = useState('');
  const [originalCaption, setOriginalCaption] = useState('');
  const [cropX, setCropX] = useState(0.5);
  const [layout, setLayout] = useState<'fill' | 'fit'>('fill');
  const [captionPosition, setCaptionPosition] = useState<'top' | 'middle' | 'bottom'>('bottom');
  const [captionStyle, setCaptionStyle] = useState<'Dynamic Pop' | 'Minimalist'>('Dynamic Pop');
  const [publishTitle, setPublishTitle] = useState('');
  const [publishDescription, setPublishDescription] = useState('');
  const [tags, setTags] = useState('');
  const [madeForKids, setMadeForKids] = useState(false);
  const [synthetic, setSynthetic] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [playerTime, setPlayerTime] = useState(0);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    api<EditorPayload & { success: boolean }>(`/api/clips/${clipId}`)
      .then((d) => {
        setData(d);
        const c = d.clip;
        setTitle(c.title);
        setStart(fmtPrecise(c.startTime));
        setEnd(fmtPrecise(c.endTime));
        const text = d.words.map((w) => w.w).join(' ');
        setCaptionText(text);
        setOriginalCaption(text);
        setCropX(c.cropX);
        setLayout(c.layout);
        setCaptionPosition(c.captionPosition);
        setCaptionStyle(c.captionStyle);
        setPublishTitle(c.publishTitle);
        setPublishDescription(c.publishDescription);
        setTags(c.publishTags.join(', '));
        setMadeForKids(c.madeForKids);
        setSynthetic(c.containsSyntheticMedia);
      })
      .catch((err) => {
        toast.error(errorMessage(err));
        onCloseRef.current();
      });
  }, [clipId, reloadKey]);

  // Escape closes; focus moves into the dialog when it opens.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    dialogRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const startS = parseTime(start);
  const endS = parseTime(end);
  // Trimming changes which words are in the clip, so trim and caption edits
  // are saved one at a time (the caption box always shows the saved range).
  const trimChanged = !!data && (Math.abs(startS - data.clip.startTime) > 0.05 || Math.abs(endS - data.clip.endTime) > 0.05);
  const captionsChanged = captionText.trim() !== originalCaption.trim();
  const validTimes = Number.isFinite(startS) && Number.isFinite(endS) && endS - startS >= 5 && endS - startS <= 180;

  const nudge = (which: 'start' | 'end', delta: number) => {
    const cur = which === 'start' ? startS : endS;
    if (!Number.isFinite(cur)) return;
    const next = Math.max(0, Math.round((cur + delta) * 10) / 10);
    (which === 'start' ? setStart : setEnd)(fmtPrecise(next));
  };

  const preview = () => {
    const v = videoRef.current;
    if (!v || !Number.isFinite(startS)) return;
    v.currentTime = startS;
    void v.play();
  };

  // Stop the preview at the clip's end point.
  const onTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    setPlayerTime(v.currentTime);
    if (Number.isFinite(endS) && v.currentTime >= endS && !v.paused) v.pause();
  };

  const save = async (opts: { keepOpen?: boolean } = {}) => {
    if (!data) return;
    if (!validTimes) {
      toast.error('Check the start and end times — a clip must be 5 seconds to 3 minutes long.');
      setTab('trim');
      return;
    }
    if (!title.trim()) {
      toast.error('Give the clip a title.');
      return;
    }
    setSaving(true);
    const c = data.clip;
    const body: Record<string, unknown> = {
      title,
      publishTitle,
      publishDescription,
      publishTags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      madeForKids,
      containsSyntheticMedia: synthetic,
    };
    if (Math.abs(startS - c.startTime) > 0.05 || Math.abs(endS - c.endTime) > 0.05) Object.assign(body, { startTime: startS, endTime: endS });
    if (captionText.trim() !== originalCaption.trim()) body.captionText = captionText;
    if (cropX !== c.cropX) body.cropX = cropX;
    if (layout !== c.layout) body.layout = layout;
    if (captionPosition !== c.captionPosition) body.captionPosition = captionPosition;
    if (captionStyle !== c.captionStyle) body.captionStyle = captionStyle;
    try {
      const res = await api<{ clip: ClipData }>(`/api/clips/${clipId}`, { method: 'PATCH', body });
      toast.success(res.clip.renderStatus === 'stale' ? 'Saved. Export again to apply your changes to the video.' : 'Saved.');
      onSaved(res.clip);
      if (opts.keepOpen) {
        setData(null);
        setReloadKey((k) => k + 1);
      } else {
        onClose();
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const isFile = data?.source.kind === 'file';
  const youtubeId = data?.source.kind === 'youtube' ? data.source.videoId : null;
  const sourceUrl = `/api/media/source/${projectId}`;

  const tabs: [Tab, string][] = [['trim', 'Trim'], ['captions', 'Captions'], ['framing', 'Framing'], ['publish', 'Publishing']];

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="clip-editor-title" ref={dialogRef} tabIndex={-1}>
        <div className="modal-head">
          <h2 id="clip-editor-title" className="section-title">Edit clip</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close editor"><X size={16} /></button>
        </div>

        {!data ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}><RefreshCw className="animate-spin" size={20} aria-label="Loading" /></div>
        ) : (
          <>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label" htmlFor="ce-title">Clip name</label>
                <input id="ce-title" className="input-field" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
              </div>

              <div className="segmented-control" role="tablist" aria-label="Editor sections" style={{ alignSelf: 'flex-start', flexWrap: 'wrap' }}>
                {tabs.map(([id, label]) => (
                  <button key={id} type="button" role="tab" aria-selected={tab === id} className={`segmented-item ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
                    {label}
                  </button>
                ))}
              </div>

              {tab === 'trim' && (
                <div className="editor-grid">
                  <div>
                    {isFile ? (
                      <>
                        <video ref={videoRef} src={sourceUrl} controls preload="metadata" onTimeUpdate={onTimeUpdate} className="editor-player" />
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.5rem', alignItems: 'center' }}>
                          <button type="button" className="btn btn-secondary btn-sm" onClick={preview}><Play size={12} /> Play clip</button>
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setStart(fmtPrecise(playerTime))}><Crosshair size={12} /> Start here</button>
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEnd(fmtPrecise(playerTime))}><Crosshair size={12} /> End here</button>
                          <span className="text-subtle tnum" style={{ fontSize: '0.75rem' }}>Player at {fmtPrecise(playerTime)}</span>
                        </div>
                      </>
                    ) : youtubeId ? (
                      <iframe
                        className="editor-player"
                        title="Source video preview"
                        src={`https://www.youtube-nocookie.com/embed/${youtubeId}?start=${Math.floor(Number.isFinite(startS) ? startS : 0)}&end=${Math.ceil(Number.isFinite(endS) ? endS : 0)}&rel=0`}
                        allow="encrypted-media; picture-in-picture"
                        allowFullScreen
                      />
                    ) : (
                      <p className="text-subtle" style={{ fontSize: '0.8125rem' }}>This project came from a pasted transcript, so there&apos;s no video to preview.</p>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {captionsChanged && (
                      <p className="notice notice-warning" style={{ fontSize: '0.75rem' }}>
                        You’ve edited the captions. Save them first, then adjust the trim.
                      </p>
                    )}
                    {(['start', 'end'] as const).map((which) => (
                      <fieldset className="form-group" key={which} disabled={captionsChanged} style={{ border: 0 }}>
                        <label className="form-label" htmlFor={`ce-${which}`}>{which === 'start' ? 'Starts at' : 'Ends at'} (m:ss.s)</label>
                        <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => nudge(which, -1)} aria-label={`${which} 1 second earlier`}>−1s</button>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => nudge(which, -0.2)} aria-label={`${which} 0.2 seconds earlier`}>−.2</button>
                          <input
                            id={`ce-${which}`}
                            className="input-field tnum"
                            style={{ width: 96, textAlign: 'center' }}
                            value={which === 'start' ? start : end}
                            onChange={(e) => (which === 'start' ? setStart : setEnd)(e.target.value)}
                            aria-invalid={!Number.isFinite(which === 'start' ? startS : endS)}
                          />
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => nudge(which, 0.2)} aria-label={`${which} 0.2 seconds later`}>+.2</button>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => nudge(which, 1)} aria-label={`${which} 1 second later`}>+1s</button>
                        </div>
                      </fieldset>
                    ))}
                    <p className={validTimes ? 'text-subtle' : ''} style={{ fontSize: '0.75rem', color: validTimes ? undefined : 'var(--red)' }} role="status">
                      {validTimes ? `Length: ${(endS - startS).toFixed(1)}s` : 'A clip must be between 5 seconds and 3 minutes.'}
                    </p>
                    <p className="text-subtle" style={{ fontSize: '0.75rem' }}>
                      Start at the beginning of a thought and end just after the point lands. Captions follow the new range automatically.
                    </p>
                  </div>
                </div>
              )}

              {tab === 'captions' && trimChanged && (
                <div className="notice notice-warning" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                  <span>You changed the trim. Save it first so the captions show the words in the new range.</span>
                  <button type="button" className="btn btn-secondary btn-sm" disabled={saving || !validTimes} onClick={() => save({ keepOpen: true })}>Save trim</button>
                </div>
              )}

              {tab === 'captions' && !trimChanged && (
                <div className="form-group">
                  <label className="form-label" htmlFor="ce-captions">Words burned into the video</label>
                  <textarea id="ce-captions" className="input-field" style={{ minHeight: 180, lineHeight: 1.6 }} value={captionText} onChange={(e) => setCaptionText(e.target.value)} />
                  <p className="text-subtle" style={{ fontSize: '0.75rem' }}>
                    Fix misheard words, names and terms. Swapping words one-for-one keeps their exact timing; adding or removing words spreads the new text across the same time.
                  </p>
                  {captionText.trim() !== originalCaption.trim() && (
                    <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setCaptionText(originalCaption)}>Undo caption changes</button>
                  )}
                </div>
              )}

              {tab === 'framing' && (
                <div className="editor-grid">
                  <div className="framing-preview" aria-label="Framing preview (9:16)">
                    {isFile ? (
                      <video
                        src={sourceUrl}
                        muted
                        preload="metadata"
                        onLoadedMetadata={(e) => { e.currentTarget.currentTime = Number.isFinite(startS) ? startS + 1 : 0; }}
                        style={{ width: '100%', height: '100%', objectFit: layout === 'fill' ? 'cover' : 'contain', objectPosition: `${cropX * 100}% 50%`, background: '#000' }}
                      />
                    ) : (
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', textAlign: 'center' }} className="text-subtle">
                        <span style={{ fontSize: '0.75rem' }}>Preview is available for uploaded files. Your framing choices still apply to the export.</span>
                      </div>
                    )}
                    <div className={`framing-caption pos-${captionPosition}`} aria-hidden="true">
                      {captionStyle === 'Minimalist' ? 'Caption preview' : 'CAPTION PREVIEW'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                    <fieldset className="form-group" style={{ border: 0 }}>
                      <legend className="form-label">Layout</legend>
                      <div className="segmented-control">
                        <button type="button" className={`segmented-item ${layout === 'fill' ? 'active' : ''}`} aria-pressed={layout === 'fill'} onClick={() => setLayout('fill')}>Fill frame (crop)</button>
                        <button type="button" className={`segmented-item ${layout === 'fit' ? 'active' : ''}`} aria-pressed={layout === 'fit'} onClick={() => setLayout('fit')}>Show everything</button>
                      </div>
                      <span className="text-subtle" style={{ fontSize: '0.72rem' }}>Use “Show everything” for slides or wide shots so nothing is cut off.</span>
                    </fieldset>
                    {layout === 'fill' && (
                      <div className="form-group">
                        <label className="form-label" htmlFor="ce-crop">Keep in frame: {cropX < 0.4 ? 'left side' : cropX > 0.6 ? 'right side' : 'center'}</label>
                        <input id="ce-crop" type="range" min={0} max={1} step={0.01} value={cropX} onChange={(e) => setCropX(Number(e.target.value))} />
                      </div>
                    )}
                    <fieldset className="form-group" style={{ border: 0 }}>
                      <legend className="form-label">Caption position</legend>
                      <div className="segmented-control">
                        {(['top', 'middle', 'bottom'] as const).map((p) => (
                          <button key={p} type="button" className={`segmented-item ${captionPosition === p ? 'active' : ''}`} aria-pressed={captionPosition === p} onClick={() => setCaptionPosition(p)}>
                            {p[0].toUpperCase() + p.slice(1)}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                    <fieldset className="form-group" style={{ border: 0 }}>
                      <legend className="form-label">Caption style</legend>
                      <div className="segmented-control">
                        <button type="button" className={`segmented-item ${captionStyle === 'Dynamic Pop' ? 'active' : ''}`} aria-pressed={captionStyle === 'Dynamic Pop'} onClick={() => setCaptionStyle('Dynamic Pop')}>Bold, 3 words</button>
                        <button type="button" className={`segmented-item ${captionStyle === 'Minimalist' ? 'active' : ''}`} aria-pressed={captionStyle === 'Minimalist'} onClick={() => setCaptionStyle('Minimalist')}>Clean lines</button>
                      </div>
                    </fieldset>
                  </div>
                </div>
              )}

              {tab === 'publish' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="ce-ptitle">YouTube title</label>
                    <input id="ce-ptitle" className="input-field" value={publishTitle} maxLength={100} onChange={(e) => setPublishTitle(e.target.value)} />
                    <span className="text-subtle" style={{ fontSize: '0.72rem' }}>{publishTitle.length}/100 · “#Shorts” is added for clips under 3 minutes.</span>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="ce-pdesc">Description</label>
                    <textarea id="ce-pdesc" className="input-field" style={{ minHeight: 110 }} value={publishDescription} maxLength={5000} onChange={(e) => setPublishDescription(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="ce-tags">Tags (comma-separated)</label>
                    <input id="ce-tags" className="input-field" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="lesson, physics, exam tips" />
                  </div>
                  <fieldset className="form-group" style={{ border: 0 }}>
                    <legend className="form-label">Is this video made for kids?</legend>
                    <label className="check-row"><input type="radio" name="kids" checked={!madeForKids} onChange={() => setMadeForKids(false)} /> No, it’s not made for kids</label>
                    <label className="check-row"><input type="radio" name="kids" checked={madeForKids} onChange={() => setMadeForKids(true)} /> Yes, it’s made for kids</label>
                    <span className="text-subtle" style={{ fontSize: '0.72rem' }}>You’re legally required to answer this accurately (COPPA). It limits comments and ads when “Yes”.</span>
                  </fieldset>
                  <label className="check-row">
                    <input type="checkbox" checked={synthetic} onChange={(e) => setSynthetic(e.target.checked)} />
                    Contains realistic altered or AI-generated people, places or events
                  </label>
                </div>
              )}
            </div>
            <div className="modal-foot">
              <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={() => save()} disabled={saving}>
                {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />} Save changes
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
