import React, { useState } from 'react';
import { CheckCircle, XCircle, FileText, Video, Tag, Clock, Layers } from 'lucide-react';
import toast from 'react-hot-toast';

interface ApprovalItem {
  id: string;
  topic: string;
  script: string;
  visualPrompts: string;
  captions: string;
  seoTitle?: string;
  seoDescription?: string;
  seoTags?: string;
  createdAt: string;
}

interface Props {
  items: ApprovalItem[];
  onRefresh: () => void;
}

export const ApprovalQueueView: React.FC<Props> = ({ items, onRefresh }) => {
  const [activeViewTab, setActiveViewTab] = useState<Record<string, 'script' | 'scenes' | 'seo'>>({});

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    toast.loading(`${action === 'approve' ? 'Approving' : 'Rejecting'} content...`, { id: 'approval' });
    try {
      const res = await fetch('/api/approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || (action === 'approve' ? 'Approved!' : 'Rejected!'), { id: 'approval', duration: 6000 });
        onRefresh();
      } else {
        toast.error(data.error || 'Failed to process approval.', { id: 'approval', duration: 7000 });
      }
    } catch (e) {
      toast.error('Network error processing approval.', { id: 'approval' });
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
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.25rem' }}>Human Approval Queue</h2>
          <p className="text-muted" style={{ fontSize: '0.85rem' }}>
            Review AI generated scripts, B-Roll prompts, and SEO tags before video production starts.
          </p>
        </div>
        <span className="badge badge-neutral" style={{ padding: '0.4rem 0.85rem' }}>
          {items.length} {items.length === 1 ? 'Item Pending' : 'Items Pending'}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {items.length === 0 ? (
          <div className="panel-card" style={{ padding: '3.5rem 2rem', textAlign: 'center', background: 'var(--surface-subtle)' }}>
            <Layers size={32} color="var(--foreground-subtle)" style={{ marginBottom: '0.75rem' }} />
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.35rem' }}>Queue is Clean</h3>
            <p className="text-muted" style={{ fontSize: '0.85rem', maxWidth: '400px', margin: '0 auto' }}>
              No pending scripts awaiting approval. Trigger an automated workflow cycle from the Overview dashboard.
            </p>
          </div>
        ) : (
          items.map((item) => {
            const scenes = safeParseJSON(item.visualPrompts, []);
            const tags = safeParseJSON(item.seoTags || '[]', []);
            const currentTab = activeViewTab[item.id] || 'script';

            return (
              <div key={item.id} className="panel-card">
                {/* Header Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
                      <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>{item.topic}</h3>
                      <span className="badge badge-warning">Needs Approval</span>
                    </div>
                    <p className="text-subtle" style={{ fontSize: '0.775rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Clock size={12} /> Generated {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '0.6rem' }}>
                    <button onClick={() => handleAction(item.id, 'reject')} className="btn btn-danger">
                      <XCircle size={15} /> Reject
                    </button>
                    <button onClick={() => handleAction(item.id, 'approve')} className="btn btn-primary">
                      <CheckCircle size={15} /> Approve & Render
                    </button>
                  </div>
                </div>

                {/* Internal Navigation Tabs */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--surface-border)', paddingBottom: '0.75rem' }}>
                  <button 
                    onClick={() => setActiveViewTab(prev => ({ ...prev, [item.id]: 'script' }))}
                    className={`btn ${currentTab === 'script' ? 'btn-secondary' : 'btn-ghost'}`}
                    style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem' }}
                  >
                    <FileText size={14} /> Script Preview
                  </button>
                  <button 
                    onClick={() => setActiveViewTab(prev => ({ ...prev, [item.id]: 'scenes' }))}
                    className={`btn ${currentTab === 'scenes' ? 'btn-secondary' : 'btn-ghost'}`}
                    style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem' }}
                  >
                    <Video size={14} /> Scenes ({scenes.length})
                  </button>
                  {item.seoTitle && (
                    <button 
                      onClick={() => setActiveViewTab(prev => ({ ...prev, [item.id]: 'seo' }))}
                      className={`btn ${currentTab === 'seo' ? 'btn-secondary' : 'btn-ghost'}`}
                      style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem' }}
                    >
                      <Tag size={14} /> SEO & Metadata
                    </button>
                  )}
                </div>

                {/* Tab Content Panels */}
                {currentTab === 'script' && (
                  <div style={{ background: 'var(--background)', padding: '1.25rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--surface-border)' }}>
                    <p style={{ fontSize: '0.875rem', color: 'var(--foreground)', lineHeight: '1.65', whiteSpace: 'pre-wrap' }}>
                      {item.script}
                    </p>
                  </div>
                )}

                {currentTab === 'scenes' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {scenes.map((scene: any, i: number) => (
                      <div key={i} style={{ background: 'var(--background)', padding: '0.9rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--surface-border)', fontSize: '0.825rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                          <span style={{ fontWeight: 700, color: 'var(--primary)' }}>Scene #{i + 1}</span>
                          {scene.durationEstimate && <span className="text-subtle">{scene.durationEstimate}s</span>}
                        </div>
                        <p style={{ color: 'var(--foreground)', marginBottom: '0.25rem' }}><strong>Audio:</strong> {scene.spokenText || scene}</p>
                        {scene.bRollPrompt && <p className="text-muted"><strong>Visual B-Roll:</strong> {scene.bRollPrompt}</p>}
                      </div>
                    ))}
                  </div>
                )}

                {currentTab === 'seo' && item.seoTitle && (
                  <div style={{ background: 'var(--background)', padding: '1.25rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--surface-border)', display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.875rem' }}>
                    <div>
                      <span className="text-subtle" style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Title</span>
                      <p style={{ fontWeight: 600, color: 'var(--foreground)' }}>{item.seoTitle}</p>
                    </div>
                    {item.seoDescription && (
                      <div>
                        <span className="text-subtle" style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Description</span>
                        <p className="text-muted" style={{ fontSize: '0.85rem', lineHeight: '1.5' }}>{item.seoDescription}</p>
                      </div>
                    )}
                    {tags.length > 0 && (
                      <div>
                        <span className="text-subtle" style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: '0.35rem' }}>Hashtags</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                          {tags.map((t: string, i: number) => (
                            <span key={i} className="badge badge-neutral">#{t}</span>
                          ))}
                        </div>
                      </div>
                    )}
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
