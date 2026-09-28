"use client";

import React, { useMemo, useState } from 'react';
import { Download, ExternalLink, FileText, Film, Scissors } from 'lucide-react';
import { humanizeHook } from '@/lib/hookLabels';
import type { ApprovalQueueItem, RenderedClipData } from '@/types';

interface Props {
  renderedClips: RenderedClipData[];
  autopilotScripts: ApprovalQueueItem[];
  onOpenProject: (projectId: string) => void;
}

function fmt(s: number): string {
  const t = Math.max(0, Math.floor(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

export function ContentLibraryView({ renderedClips, autopilotScripts, onOpenProject }: Props) {
  const [filter, setFilter] = useState<'all' | 'clips' | 'scripts'>('all');
  const approvedScripts = useMemo(() => autopilotScripts.filter((s) => s.status === 'approved'), [autopilotScripts]);

  const showClips = filter !== 'scripts';
  const showScripts = filter !== 'clips';
  const empty = renderedClips.length === 0 && approvedScripts.length === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="panel-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h3 style={{ fontSize: '0.9375rem', fontWeight: 700 }}>Your finished content</h3>
          <p className="text-subtle" style={{ fontSize: '0.75rem' }}>
            Rendered clips ready to download and post, plus approved Autopilot scripts.
          </p>
        </div>
        <div className="segmented-control">
          <button className={`segmented-item ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
            All ({renderedClips.length + approvedScripts.length})
          </button>
          <button className={`segmented-item ${filter === 'clips' ? 'active' : ''}`} onClick={() => setFilter('clips')}>
            <Film size={13} /> Clips ({renderedClips.length})
          </button>
          <button className={`segmented-item ${filter === 'scripts' ? 'active' : ''}`} onClick={() => setFilter('scripts')}>
            <FileText size={13} /> Scripts ({approvedScripts.length})
          </button>
        </div>
      </div>

      {empty && (
        <div className="panel" style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
          <Scissors style={{ width: 20, height: 20, margin: '0 auto 0.6rem', opacity: 0.5 }} />
          <p className="text-muted" style={{ fontSize: '0.8125rem', maxWidth: 440, margin: '0 auto' }}>
            Nothing here yet. Render a clip in Repurpose Studio (or approve one in the Approval Queue), or approve an
            Autopilot script — finished content shows up here.
          </p>
        </div>
      )}

      {showClips && renderedClips.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))', gap: '0.85rem' }}>
          {renderedClips.map((clip) => (
            <div key={clip.id} className="panel-card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <video
                src={clip.videoUrl}
                controls
                preload="metadata"
                style={{ width: '100%', height: 220, background: '#000', objectFit: 'contain' }}
              />
              <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: 1 }}>
                <h4 style={{ fontSize: '0.8125rem', fontWeight: 600, lineHeight: 1.35 }}>{clip.title}</h4>
                <p className="text-subtle" style={{ fontSize: '0.7rem' }}>
                  {clip.project.title} · {fmt(clip.startTime)}–{fmt(clip.endTime)} · {humanizeHook(clip.hookType)}
                </p>
                <div style={{ display: 'flex', gap: '0.4rem', marginTop: 'auto', paddingTop: '0.35rem' }}>
                  <a href={clip.videoUrl} target="_blank" rel="noreferrer" download className="btn btn-primary btn-sm" style={{ flex: 1 }}>
                    <Download size={12} /> Download
                  </a>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => onOpenProject(clip.projectId)}>
                    <ExternalLink size={12} /> Captions
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showScripts && approvedScripts.length > 0 && (
        <div className="panel">
          <div className="panel-header">
            <span className="section-title">Approved Autopilot scripts</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {approvedScripts.map((s) => (
              <details key={s.id} style={{ padding: '0.85rem 1.1rem', borderTop: '1px solid var(--border)' }}>
                <summary style={{ cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600 }}>
                  {s.seoTitle || s.topic}
                  <span className="text-subtle" style={{ fontWeight: 400, marginLeft: '0.5rem', fontSize: '0.72rem' }}>
                    {new Date(s.createdAt).toLocaleDateString()}
                  </span>
                </summary>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-2)', lineHeight: 1.6, whiteSpace: 'pre-wrap', marginTop: '0.6rem' }}>
                  {s.script}
                </p>
              </details>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
