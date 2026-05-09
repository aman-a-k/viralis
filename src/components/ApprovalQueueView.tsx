import React from 'react';
import { ClipboardCheck, ThumbsUp, ThumbsDown, FileText, ImageIcon } from 'lucide-react';
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
        toast.success(`Content ${action === 'approve' ? 'approved' : 'rejected'}!`, { id: 'approval' });
        onRefresh();
      } else {
        toast.error('Failed to process approval.', { id: 'approval' });
      }
    } catch (e) {
      toast.error('Network error processing approval.', { id: 'approval' });
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="glass-panel" style={{ padding: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <ClipboardCheck color="var(--primary)" /> Content Approval Queue
        </h2>
        <p style={{ color: '#94a3b8', marginBottom: '2rem' }}>
          Review and approve AI-generated scripts and visuals before they go live.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {items.length === 0 ? (
            <div style={{ padding: '4rem', textAlign: 'center', border: '1px dashed var(--surface-border)', borderRadius: '12px' }}>
              <p style={{ color: '#64748b' }}>No pending items in the queue. Everything is up to date.</p>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.id} className="glass-card" style={{ padding: '2rem', borderLeft: '4px solid var(--primary)' }}>
                <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{item.topic}</h3>
                    <p style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Generated on {new Date(item.createdAt).toLocaleString()}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button onClick={() => handleAction(item.id, 'reject')} className="btn btn-outline" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>
                      <ThumbsDown size={18} /> Reject
                    </button>
                    <button onClick={() => handleAction(item.id, 'approve')} className="btn btn-primary">
                      <ThumbsUp size={18} /> Approve & Publish
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--surface-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                      <FileText size={16} color="var(--primary)" />
                      <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Final Script</span>
                    </div>
                    <p style={{ fontSize: '0.875rem', color: '#cbd5e1', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                      {item.script}
                    </p>
                  </div>

                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--surface-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                      <ImageIcon size={16} color="var(--secondary)" />
                      <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Visual Prompts (Scenes)</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {JSON.parse(item.visualPrompts).map((scene: any, i: number) => (
                        <div key={i} style={{ fontSize: '0.8rem', color: '#94a3b8', padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <strong>T:</strong> {scene.spokenText}<br/>
                          <strong>V:</strong> {scene.bRollPrompt}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {item.seoTitle && (
                  <div style={{ marginTop: '2rem', background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--surface-border)' }}>
                     <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--success)' }}>SEO & Metadata</span>
                     </div>
                     <p style={{ fontSize: '0.875rem', color: '#fff', marginBottom: '0.5rem' }}><strong>Title:</strong> {item.seoTitle}</p>
                     <p style={{ fontSize: '0.875rem', color: '#cbd5e1', marginBottom: '1rem', whiteSpace: 'pre-wrap' }}><strong>Description:</strong><br/>{item.seoDescription}</p>
                     {item.seoTags && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                          {JSON.parse(item.seoTags).map((tag: string, i: number) => (
                            <span key={i} style={{ fontSize: '0.7rem', padding: '0.25rem 0.6rem', borderRadius: '20px', background: 'rgba(255,255,255,0.1)' }}>#{tag}</span>
                          ))}
                        </div>
                     )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
