"use client";

import React, { useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import { ProjectData, ClipData } from '@/types';
import { 
  Scissors, Play, Pause, Smartphone, Square, Monitor, Copy, Check, 
  Send, Clock, Sparkles, Volume2, VolumeX, Maximize2, Share2, 
  ThumbsUp, MessageSquare, Repeat, Heart, Bookmark, Music, ShieldCheck, 
  ChevronDown, Plus, RefreshCw, Layers, Upload, Download, Film, Video as VideoIcon
} from 'lucide-react';

interface RepurposeStudioViewProps {
  projects: ProjectData[];
  onRefresh: () => void;
}

export function RepurposeStudioView({ projects = [], onRefresh }: RepurposeStudioViewProps) {
  const [videoUrl, setVideoUrl] = useState('');
  const [videoTitle, setVideoTitle] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [showImportDrawer, setShowImportDrawer] = useState(false);
  
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id || '');
  const [selectedClipId, setSelectedClipId] = useState<string>(projects[0]?.clips?.[0]?.id || '');
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '1:1' | '16:9'>('9:16');
  const [captionStyle, setCaptionStyle] = useState<'Dynamic Pop' | 'Minimalist'>('Dynamic Pop');
  const [activePlatform, setActivePlatform] = useState<'instagram' | 'youtube' | 'linkedin' | 'twitter' | 'tiktok'>('instagram');
  const [copied, setCopied] = useState(false);
  const [activeVideoSrc, setActiveVideoSrc] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const activeProject = projects.find(p => p.id === selectedProjectId) || projects[0];
  const activeClip = activeProject?.clips?.find(c => c.id === selectedClipId) || activeProject?.clips?.[0];

  // Update active video source whenever activeClip changes
  useEffect(() => {
    if (activeClip) {
      const defaultSrc = activeClip.videoUrl || `/clips/clip_${activeClip.id}_9_16_pop.mp4`;
      setActiveVideoSrc(defaultSrc);
    }
  }, [activeClip]);

  const handleIngestUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoUrl && !videoTitle) {
      toast.error('Please enter a YouTube link or episode title.');
      return;
    }

    setIsProcessing(true);
    toast.loading('Analyzing long-form video & cutting viral moments...', { id: 'ingest' });

    try {
      const res = await fetch('/api/repurpose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: videoTitle || 'Keynote Masterclass Episode',
          sourceVideoUrl: videoUrl,
          sourceType: videoUrl.includes('youtube') ? 'youtube' : 'upload',
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(data.message || 'Clips extracted with real video cuts!', { id: 'ingest', duration: 4000 });
        setVideoUrl('');
        setVideoTitle('');
        setShowImportDrawer(false);
        onRefresh();
        if (data.project) {
          setSelectedProjectId(data.project.id);
          if (data.clips?.[0]) {
            setSelectedClipId(data.clips[0].id);
            setActiveVideoSrc(data.clips[0].videoUrl || '');
          }
        }
      } else {
        toast.error(data.error || 'Ingest failed', { id: 'ingest' });
      }
    } catch (err) {
      toast.error('Error connecting to Viralis API.', { id: 'ingest' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('video', file);
    formData.append('title', file.name.replace(/\.[^/.]+$/, ''));

    setIsProcessing(true);
    toast.loading(`Uploading & cutting "${file.name}" with FFmpeg...`, { id: 'upload-video' });

    try {
      const res = await fetch('/api/repurpose/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`Video processed! Extracted ${data.clips?.length || 0} real clips.`, { id: 'upload-video', duration: 4500 });
        setShowImportDrawer(false);
        onRefresh();
        if (data.project) {
          setSelectedProjectId(data.project.id);
          if (data.clips?.[0]) {
            setSelectedClipId(data.clips[0].id);
            setActiveVideoSrc(data.clips[0].videoUrl || '');
          }
        }
      } else {
        toast.error(data.error || 'Upload failed', { id: 'upload-video' });
      }
    } catch (err) {
      toast.error('Network error uploading video.', { id: 'upload-video' });
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRenderAspectOrStyle = async (newAspect: '9:16' | '1:1' | '16:9', newStyle: 'Dynamic Pop' | 'Minimalist') => {
    if (!activeClip) return;
    setIsRendering(true);
    toast.loading(`Rendering real ${newAspect} cut with ${newStyle} subtitles...`, { id: 'render-clip' });

    try {
      const res = await fetch('/api/repurpose/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clipId: activeClip.id,
          aspectRatio: newAspect,
          captionStyle: newStyle,
        }),
      });

      const data = await res.json();
      if (data.success && data.videoUrl) {
        setActiveVideoSrc(data.videoUrl);
        toast.success(`Video updated! Playing ${newAspect} cut.`, { id: 'render-clip', duration: 3500 });
        onRefresh();
      } else {
        toast.error(data.error || 'Could not render clip', { id: 'render-clip' });
      }
    } catch (err) {
      toast.error('Render request failed', { id: 'render-clip' });
    } finally {
      setIsRendering(false);
    }
  };

  const handleApproveClip = async (clipId: string) => {
    toast.loading('Queueing clip for multi-platform distribution...', { id: 'approve' });
    try {
      const res = await fetch(`/api/repurpose/clip/${clipId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve_to_queue' }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Clip queued to Unified Production Queue!', { id: 'approve', duration: 4000 });
        onRefresh();
      } else {
        toast.error(data.error || 'Failed to queue clip.', { id: 'approve' });
      }
    } catch (err) {
      toast.error('Network error queueing clip.', { id: 'approve' });
    }
  };

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Platform copy copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  let parsedCaptions: any = {};
  if (activeClip) {
    try {
      parsedCaptions = typeof activeClip.captionVersions === 'string' 
        ? JSON.parse(activeClip.captionVersions)
        : activeClip.captionVersions;
    } catch (e) {
      parsedCaptions = { instagram: activeClip.captionVersions };
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Hidden File Input for Direct Computer Upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="video/mp4,video/mov,video/quicktime,video/webm"
        style={{ display: 'none' }}
      />

      {/* Top Studio Control Bar */}
      <div className="panel-card" style={{ padding: '0.85rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div>
            <span className="text-subtle" style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Master Episode
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.15rem' }}>
              <select
                value={selectedProjectId}
                onChange={(e) => {
                  setSelectedProjectId(e.target.value);
                  const proj = projects.find(p => p.id === e.target.value);
                  if (proj?.clips?.[0]) {
                    setSelectedClipId(proj.clips[0].id);
                    setActiveVideoSrc(proj.clips[0].videoUrl || '');
                  }
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--foreground)',
                  fontSize: '0.9375rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  outline: 'none',
                  paddingRight: '1rem',
                }}
              >
                {projects.map(p => (
                  <option key={p.id} value={p.id} style={{ background: '#18181b', color: '#fff' }}>
                    {p.title}
                  </option>
                ))}
              </select>
              <span className="badge badge-neutral" style={{ fontSize: '0.6875rem' }}>
                {activeProject?.clips?.length || 0} Surfaced Highlights
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button 
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="btn btn-secondary"
            style={{ fontSize: '0.75rem', padding: '0.45rem 0.85rem' }}
          >
            <Upload size={13} /> Upload Video File
          </button>
          <button 
            onClick={() => setShowImportDrawer(!showImportDrawer)}
            className="btn btn-secondary"
            style={{ fontSize: '0.75rem', padding: '0.45rem 0.85rem' }}
          >
            <Plus size={13} /> Import Link
          </button>
          {activeClip && (
            <button
              onClick={() => handleApproveClip(activeClip.id)}
              className="btn btn-primary"
              style={{ fontSize: '0.75rem', padding: '0.45rem 0.85rem' }}
            >
              <Send size={13} /> Push to Queue
            </button>
          )}
        </div>
      </div>

      {/* Collapsible Import Drawer */}
      {showImportDrawer && (
        <div className="panel-card" style={{ background: 'var(--surface-subtle)', border: '1px solid var(--surface-border)', padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: 700 }}>Import Long-form Video for Real Cutting</h3>
            <button onClick={() => setShowImportDrawer(false)} className="btn btn-ghost" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}>
              Cancel
            </button>
          </div>
          <form onSubmit={handleIngestUrl} style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Episode Title (e.g. Scaling From 0 to 1M Users)..."
              value={videoTitle}
              onChange={(e) => setVideoTitle(e.target.value)}
              className="input-field"
              style={{ flex: '1 1 220px' }}
            />
            <input
              type="text"
              placeholder="Paste YouTube or MP4 URL..."
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              className="input-field"
              style={{ flex: '2 1 300px' }}
            />
            <button type="submit" className="btn btn-primary" disabled={isProcessing} style={{ minWidth: '150px' }}>
              {isProcessing ? <RefreshCw size={13} className="animate-spin" /> : <Scissors size={13} />}
              {isProcessing ? 'Cutting Video...' : 'Extract & Cut Clips'}
            </button>
          </form>
        </div>
      )}

      {/* 3-Column Studio Workspace */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px minmax(380px, 1fr) 380px', gap: '1.25rem', alignItems: 'start' }}>
        
        {/* COLUMN 1: Ranked Highlights Timeline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 0.25rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--foreground-muted)' }}>
              Surfaced Highlights ({activeProject?.clips?.length || 0})
            </span>
            <span className="badge badge-primary" style={{ fontSize: '0.625rem' }}>
              Ranked by Virality
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', maxHeight: '780px', overflowY: 'auto' }}>
            {activeProject?.clips?.map((clip: any, index: number) => {
              const isSelected = clip.id === (activeClip?.id || selectedClipId);
              const score = clip.viralityScore || 85;
              const isHigh = score >= 90;

              return (
                <div
                  key={clip.id}
                  onClick={() => {
                    setSelectedClipId(clip.id);
                    const clipUrl = clip.videoUrl || `/clips/clip_${clip.id}_9_16_pop.mp4`;
                    setActiveVideoSrc(clipUrl);
                  }}
                  className="panel-card"
                  style={{
                    padding: '0.85rem 1rem',
                    cursor: 'pointer',
                    background: isSelected ? 'var(--surface-hover)' : 'var(--surface)',
                    borderColor: isSelected ? 'var(--primary)' : 'var(--surface-border)',
                    boxShadow: isSelected ? '0 0 0 1px var(--primary)' : 'none',
                    transition: 'all 0.12s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--foreground-subtle)', fontFamily: 'monospace' }}>
                      {Math.floor(clip.startTime / 60)}:{String(Math.floor(clip.startTime % 60)).padStart(2, '0')} - {Math.floor(clip.endTime / 60)}:{String(Math.floor(clip.endTime % 60)).padStart(2, '0')}
                    </span>
                    <span 
                      style={{ 
                        fontSize: '0.6875rem', 
                        fontWeight: 700, 
                        color: isHigh ? '#10b981' : '#6366f1', 
                        background: isHigh ? 'rgba(16, 185, 129, 0.12)' : 'rgba(99, 102, 241, 0.12)',
                        padding: '0.15rem 0.45rem',
                        borderRadius: '4px',
                        border: `1px solid ${isHigh ? 'rgba(16, 185, 129, 0.25)' : 'rgba(99, 102, 241, 0.25)'}`
                      }}
                    >
                      {score}/100 Virality
                    </span>
                  </div>

                  <h4 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--foreground)', lineHeight: 1.35, marginBottom: '0.35rem' }}>
                    {clip.title}
                  </h4>

                  <p className="text-subtle" style={{ fontSize: '0.725rem', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {clip.reasoning}
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.55rem', borderTop: '1px solid var(--surface-border-subtle)', paddingTop: '0.45rem' }}>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--foreground-muted)', fontWeight: 500 }}>
                      Cut Duration: {clip.duration}s
                    </span>
                    <span className={`badge ${clip.status === 'approved' ? 'badge-success' : 'badge-neutral'}`} style={{ fontSize: '0.625rem' }}>
                      {clip.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* COLUMN 2: Real Media Player & Aspect Ratio Studio */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Aspect Ratio & Caption Format Bar */}
          <div className="panel-card" style={{ padding: '0.65rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div className="segmented-control">
              <button
                type="button"
                onClick={() => {
                  setAspectRatio('9:16');
                  handleRenderAspectOrStyle('9:16', captionStyle);
                }}
                className={`segmented-item ${aspectRatio === '9:16' ? 'active' : ''}`}
              >
                <Smartphone size={12} /> 9:16 Vertical
              </button>
              <button
                type="button"
                onClick={() => {
                  setAspectRatio('1:1');
                  handleRenderAspectOrStyle('1:1', captionStyle);
                }}
                className={`segmented-item ${aspectRatio === '1:1' ? 'active' : ''}`}
              >
                <Square size={12} /> 1:1 Square
              </button>
              <button
                type="button"
                onClick={() => {
                  setAspectRatio('16:9');
                  handleRenderAspectOrStyle('16:9', captionStyle);
                }}
                className={`segmented-item ${aspectRatio === '16:9' ? 'active' : ''}`}
              >
                <Monitor size={12} /> 16:9 Landscape
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span className="text-subtle" style={{ fontSize: '0.6875rem', fontWeight: 600 }}>Captions:</span>
              <button
                type="button"
                onClick={() => {
                  setCaptionStyle('Dynamic Pop');
                  handleRenderAspectOrStyle(aspectRatio, 'Dynamic Pop');
                }}
                className={`segmented-item ${captionStyle === 'Dynamic Pop' ? 'active' : ''}`}
                style={{ fontSize: '0.6875rem' }}
              >
                Pop (Hormozi)
              </button>
              <button
                type="button"
                onClick={() => {
                  setCaptionStyle('Minimalist');
                  handleRenderAspectOrStyle(aspectRatio, 'Minimalist');
                }}
                className={`segmented-item ${captionStyle === 'Minimalist' ? 'active' : ''}`}
                style={{ fontSize: '0.6875rem' }}
              >
                Clean
              </button>
            </div>
          </div>

          {/* REAL VIDEO PLAYER CONTAINER */}
          <div 
            className="panel-card" 
            style={{ 
              padding: 0, 
              overflow: 'hidden', 
              background: '#040507', 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center',
              border: '1px solid var(--surface-border)'
            }}
          >
            {/* Monitor Stage with Real <video> tag */}
            <div
              style={{
                width: '100%',
                height: aspectRatio === '9:16' ? '460px' : aspectRatio === '1:1' ? '360px' : '280px',
                background: '#000000',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'height 0.2s ease',
              }}
            >
              {isRendering ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                  <RefreshCw className="animate-spin" size={24} color="var(--primary)" />
                  <span style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)' }}>Cutting & Reframing video with FFmpeg...</span>
                </div>
              ) : activeVideoSrc ? (
                <video
                  ref={videoRef}
                  key={`${activeClip?.id}-${aspectRatio}-${captionStyle}-${activeVideoSrc}`}
                  src={activeVideoSrc}
                  controls
                  autoPlay
                  loop
                  playsInline
                  style={{
                    width: aspectRatio === '9:16' ? 'auto' : '100%',
                    maxWidth: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    borderRadius: '4px',
                  }}
                />
              ) : (
                <div style={{ textAlign: 'center', padding: '1rem' }}>
                  <Film size={28} color="var(--foreground-subtle)" style={{ margin: '0 auto 0.5rem auto' }} />
                  <p className="text-muted" style={{ fontSize: '0.75rem' }}>Select a clip to play its real cut video.</p>
                  <button 
                    onClick={() => handleRenderAspectOrStyle(aspectRatio, captionStyle)} 
                    className="btn btn-primary" 
                    style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}
                  >
                    Render Clip Video
                  </button>
                </div>
              )}

              {/* Status Pill Overlays */}
              <div style={{ position: 'absolute', top: 12, left: 14, display: 'flex', gap: '0.35rem', pointerEvents: 'none' }}>
                <span className="badge badge-neutral" style={{ fontSize: '0.625rem', background: 'rgba(0,0,0,0.75)', color: '#fff' }}>
                  {aspectRatio} Reframe
                </span>
                <span className="badge badge-success" style={{ fontSize: '0.625rem', background: 'rgba(0,0,0,0.75)' }}>
                  Burned Subtitles
                </span>
              </div>
            </div>

            {/* Video Player Action Bar */}
            <div style={{ width: '100%', padding: '0.75rem 1rem', background: 'var(--surface-subtle)', borderTop: '1px solid var(--surface-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--foreground)' }}>
                  Clip #{activeClip && activeProject?.clips ? activeProject.clips.findIndex(c => c.id === activeClip.id) + 1 : 1}: {activeClip?.title}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {activeVideoSrc && (
                  <a
                    href={activeVideoSrc}
                    download={`viralis_${activeClip?.id || 'clip'}_${aspectRatio.replace(':', '_')}.mp4`}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.7rem', padding: '0.3rem 0.65rem' }}
                  >
                    <Download size={12} /> Download .MP4
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => handleRenderAspectOrStyle(aspectRatio, captionStyle)}
                  disabled={isRendering}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.7rem', padding: '0.3rem 0.65rem' }}
                >
                  <RefreshCw size={11} className={isRendering ? 'animate-spin' : ''} /> Re-Cut
                </button>
              </div>
            </div>
          </div>

          {/* Transcript Inspector */}
          {activeClip && (
            <div className="panel-card" style={{ padding: '0.85rem 1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <span className="text-subtle" style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase' }}>
                  Cut Timecode Range: {Math.floor(activeClip.startTime / 60)}:{String(Math.floor(activeClip.startTime % 60)).padStart(2, '0')} to {Math.floor(activeClip.endTime / 60)}:{String(Math.floor(activeClip.endTime % 60)).padStart(2, '0')} ({activeClip.duration}s)
                </span>
                <span style={{ fontSize: '0.6875rem', color: '#10b981', fontWeight: 700 }}>
                  Virality Probability: {activeClip.viralityScore}%
                </span>
              </div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--foreground-muted)', lineHeight: 1.5 }}>
                &quot;{activeClip.transcriptSegment}&quot;
              </p>
            </div>
          )}
        </div>

        {/* COLUMN 3: Live Social Media Platform Previews & Native Copy */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="panel-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--foreground-muted)' }}>
                Platform Preview & Copy
              </span>
              <button
                type="button"
                onClick={() => handleCopyText(parsedCaptions[activePlatform] || '')}
                className="btn btn-secondary"
                style={{ fontSize: '0.6875rem', padding: '0.25rem 0.55rem' }}
              >
                {copied ? <Check size={11} color="#10b981" /> : <Copy size={11} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>

            {/* Platform Selector Tabs */}
            <div style={{ display: 'flex', gap: '0.25rem', borderBottom: '1px solid var(--surface-border)', paddingBottom: '0.5rem', overflowX: 'auto' }}>
              {(['instagram', 'youtube', 'linkedin', 'twitter', 'tiktok'] as const).map((plat) => (
                <button
                  key={plat}
                  type="button"
                  onClick={() => setActivePlatform(plat)}
                  style={{
                    background: activePlatform === plat ? 'var(--surface-hover)' : 'transparent',
                    color: activePlatform === plat ? '#ffffff' : 'var(--foreground-muted)',
                    border: activePlatform === plat ? '1px solid var(--surface-border)' : '1px solid transparent',
                    borderRadius: '4px',
                    padding: '0.3rem 0.55rem',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  {plat === 'youtube' ? 'Shorts' : plat === 'twitter' ? 'X / Twitter' : plat}
                </button>
              ))}
            </div>

            {/* REALISTIC SOCIAL MOCKUP CARDS */}

            {/* 1. Instagram Reels Preview */}
            {activePlatform === 'instagram' && (
              <div style={{ background: '#000000', borderRadius: '10px', border: '1px solid #27272a', padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)', padding: '2px' }}>
                      <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 800 }}>
                        V
                      </div>
                    </div>
                    <div>
                      <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fff' }}>viralis.creator</p>
                      <p style={{ fontSize: '0.625rem', color: '#a1a1aa' }}>Original audio</p>
                    </div>
                  </div>
                  <span className="badge badge-neutral" style={{ fontSize: '0.625rem' }}>Follow</span>
                </div>

                <div style={{ maxHeight: '180px', overflowY: 'auto', fontSize: '0.75rem', color: '#f4f4f5', whiteSpace: 'pre-line', lineHeight: 1.45 }}>
                  {parsedCaptions.instagram}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #18181b', paddingTop: '0.5rem', color: '#a1a1aa' }}>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <Heart size={15} />
                    <MessageSquare size={15} />
                    <Share2 size={15} />
                  </div>
                  <Bookmark size={15} />
                </div>
              </div>
            )}

            {/* 2. LinkedIn Post Preview */}
            {activePlatform === 'linkedin' && (
              <div style={{ background: '#111317', borderRadius: '10px', border: '1px solid #27272a', padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#fff' }}>
                    V
                  </div>
                  <div>
                    <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fff' }}>Viralis Media Lab <span style={{ color: '#6b7280', fontWeight: 400 }}>• 1st</span></p>
                    <p style={{ fontSize: '0.625rem', color: '#9ca3af' }}>AI Video Systems & Distribution • 2h</p>
                  </div>
                </div>

                <div style={{ maxHeight: '200px', overflowY: 'auto', fontSize: '0.75rem', color: '#e4e4e7', whiteSpace: 'pre-line', lineHeight: 1.5 }}>
                  {parsedCaptions.linkedin}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-around', borderTop: '1px solid #27272a', paddingTop: '0.5rem', color: '#9ca3af', fontSize: '0.6875rem' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><ThumbsUp size={13} /> Like</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><MessageSquare size={13} /> Comment</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Repeat size={13} /> Repost</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Send size={13} /> Send</span>
                </div>
              </div>
            )}

            {/* 3. X (Twitter) Post Preview */}
            {activePlatform === 'twitter' && (
              <div style={{ background: '#000000', borderRadius: '10px', border: '1px solid #27272a', padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#1d9bf0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800, color: '#fff' }}>
                    𝕏
                  </div>
                  <div>
                    <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                      Viralis AI <span style={{ color: '#1d9bf0' }}>✓</span> <span style={{ color: '#71717a', fontWeight: 400 }}>@viralis_hq</span>
                    </p>
                  </div>
                </div>

                <div style={{ maxHeight: '180px', overflowY: 'auto', fontSize: '0.78125rem', color: '#e4e4e7', whiteSpace: 'pre-line', lineHeight: 1.45 }}>
                  {parsedCaptions.twitter}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #18181b', paddingTop: '0.5rem', color: '#71717a', fontSize: '0.6875rem' }}>
                  <span>💬 42</span>
                  <span>🔄 88</span>
                  <span>❤️ 412</span>
                  <span>📊 14.2K</span>
                </div>
              </div>
            )}

            {/* 4. YouTube Shorts Preview */}
            {activePlatform === 'youtube' && (
              <div style={{ background: '#0f0f0f', borderRadius: '10px', border: '1px solid #27272a', padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="badge badge-danger" style={{ fontSize: '0.625rem' }}>#Shorts</span>
                  <span style={{ fontSize: '0.625rem', color: '#a1a1aa' }}>SEO Score: 96%</span>
                </div>
                <div style={{ maxHeight: '180px', overflowY: 'auto', fontSize: '0.75rem', color: '#f4f4f5', whiteSpace: 'pre-line', lineHeight: 1.45 }}>
                  {parsedCaptions.youtube}
                </div>
              </div>
            )}

            {/* 5. TikTok Preview */}
            {activePlatform === 'tiktok' && (
              <div style={{ background: '#010101', borderRadius: '10px', border: '1px solid #27272a', padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Music size={13} color="#00f2fe" />
                  <span style={{ fontSize: '0.6875rem', color: '#a1a1aa' }}>Trending Audio Cue: Retention Hook #1</span>
                </div>
                <div style={{ maxHeight: '180px', overflowY: 'auto', fontSize: '0.75rem', color: '#f4f4f5', whiteSpace: 'pre-line', lineHeight: 1.45 }}>
                  {parsedCaptions.tiktok}
                </div>
              </div>
            )}

            {/* Raw Text Editable Copy Box */}
            <div style={{ marginTop: '0.5rem' }}>
              <span className="text-subtle" style={{ fontSize: '0.6875rem', fontWeight: 600 }}>
                Copy Editor:
              </span>
              <textarea
                readOnly
                rows={5}
                value={parsedCaptions[activePlatform] || ''}
                className="input-field"
                style={{ fontSize: '0.75rem', marginTop: '0.25rem', background: 'var(--surface-subtle)' }}
              />
            </div>

            {/* Bottom Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginTop: '0.5rem' }}>
              <button
                onClick={() => activeClip && handleApproveClip(activeClip.id)}
                className="btn btn-primary"
                style={{ width: '100%', fontSize: '0.75rem', padding: '0.55rem' }}
              >
                <Send size={13} /> Push to Unified Production Queue
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
