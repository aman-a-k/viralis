import React from 'react';
import { ClipboardCheck, ThumbsUp, ThumbsDown, FileText, Video, Sparkles, Tag } from 'lucide-react';
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
        toast.success(`Content ${action === 'approve' ? 'approved & scheduled for generation' : 'rejected'}!`, { id: 'approval' });
        onRefresh();
      } else {
        toast.error('Failed to process approval.', { id: 'approval' });
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
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div className="glass-panel" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <div style={{ padding: '0.5rem', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                <ClipboardCheck size={24} className="text-gradient" />
              </div>
              <h2 style={{ fontSize: '1.5rem' }}>Human-in-the-Loop Approval Queue</h2>
            </div>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
              Review AI-generated scripts, scene prompts, and SEO tags before automated rendering & publishing.
            </p>
          </div>
          
          <span className="badge badge-cyan" style={{ padding: '0.5rem 1rem' }}>
            {items.length} {items.length === 1 ? 'Pending Review' : 'Pending Reviews'}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {items.length === 0 ? (
            <div style={{ padding: '4rem 2rem', textAlign: 'center', background: 'rgba(15, 18, 28, 0.4)', border: '1px dashed var(--surface-border)', borderRadius: '16px' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(99, 102, 241, 0.1)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                <Sparkles size={28} color="#818cf8" />
              </div>
              <h3 style={{ fontSize: '1.1rem', color: '#ffffff', marginBottom: '0.5rem' }}>Queue is Empty</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', maxWidth: '400px', margin: '0 auto' }}>
                No pending content awaiting approval. Trigger a new workflow from the Overview tab to generate scripts.
              </p>
            </div>
          ) : (
            items.map((item) => {
              const scenes = safeParseJSON(item.visualPrompts, []);
              const tags = safeParseJSON(item.seoTags || '[]', []);

              return (
                <div key={item.id} className="glass-card" style={{ padding: '2rem', borderLeft: '4px solid #6366f1' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                      <span className="badge badge-primary" style={{ marginBottom: '0.5rem' }}>Pending Approval</span>
                      <h3 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#ffffff' }}>{item.topic}</h3>
                      <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                        Created {new Date(item.createdAt).toLocaleString()}
                      </p>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '0.85rem' }}>
                      <button onClick={() => handleAction(item.id, 'reject')} className="btn btn-danger">
                        <ThumbsDown size={17} /> Reject
                      </button>
                      <button onClick={() => handleAction(item.id, 'approve')} className="btn btn-primary">
                        <ThumbsUp size={17} /> Approve & Render
                      </button>
                    </div>
                  </div>

                  <div className="grid-cols-2" style={{ gap: '1.5rem', marginBottom: '1.5rem' }}>
                    <div style={{ background: 'rgba(10, 12, 20, 0.7)', padding: '1.5rem', borderRadius: '14px', border: '1px solid var(--surface-border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
                        <FileText size={18} color="#818cf8" />
                        <h4 style={{ fontWeight: 700, fontSize: '0.95rem', color: '#ffffff' }}>Script Preview</h4>
                      </div>
                      <p style={{ fontSize: '0.875rem', color: '#e2e8f0', lineHeight: '1.65', whiteSpace: 'pre-wrap', fontFamily: "'Inter', sans-serif" }}>
                        {item.script}
                      </p>
                    </div>

                    <div style={{ background: 'rgba(10, 12, 20, 0.7)', padding: '1.5rem', borderRadius: '14px', border: '1px solid var(--surface-border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
                        <Video size={18} color="#c084fc" />
                        <h4 style={{ fontWeight: 700, fontSize: '0.95rem', color: '#ffffff' }}>Scene Prompts ({scenes.length} Scenes)</h4>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '280px', overflowY: 'auto' }}>
                        {scenes.map((scene: any, i: number) => (
                          <div key={i} style={{ fontSize: '0.825rem', color: '#cbd5e1', padding: '0.85rem', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <p style={{ color: '#818cf8', fontWeight: 600, marginBottom: '0.2rem' }}>Scene #{i + 1}</p>
                            <p style={{ marginBottom: '0.25rem' }}><strong>Audio:</strong> {scene.spokenText || scene}</p>
                            {scene.bRollPrompt && <p style={{ color: '#94a3b8' }}><strong>B-Roll:</strong> {scene.bRollPrompt}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {item.seoTitle && (
                    <div style={{ background: 'rgba(10, 12, 20, 0.7)', padding: '1.5rem', borderRadius: '14px', border: '1px solid var(--surface-border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
                        <Tag size={18} color="#34d399" />
                        <h4 style={{ fontWeight: 700, fontSize: '0.95rem', color: '#ffffff' }}>Metadata & Tagging</h4>
                      </div>
                      <p style={{ fontSize: '0.9rem', color: '#ffffff', marginBottom: '0.5rem' }}>
                        <strong>Title:</strong> {item.seoTitle}
                      </p>
                      {item.seoDescription && (
                        <p style={{ fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '1rem' }}>
                          <strong>Description:</strong> {item.seoDescription}
                        </p>
                      )}
                      {tags.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                          {tags.map((tag: string, i: number) => (
                            <span key={i} style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem', borderRadius: '20px', background: 'rgba(52, 211, 153, 0.12)', border: '1px solid rgba(52, 211, 153, 0.3)', color: '#34d399' }}>
                              #{tag}
                            </span>
                          ))}
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
    </div>
  );
};
