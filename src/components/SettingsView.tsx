"use client";

import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { signOut } from 'next-auth/react';
import { Save, RefreshCw, Link2, Unlink, Mail, Trash2, Download, UserPlus, KeyRound, Check, Palette, MonitorPlay, Users, UserCircle } from 'lucide-react';
import type { DashboardData } from '@/types';
import { api, errorMessage, LANGUAGES } from '@/lib/client';

interface Props {
  data: DashboardData;
  onRefresh: () => void;
}

interface MembersData {
  role: string;
  members: { id: string; email: string | null; name: string | null; role: string; you: boolean }[];
  invites: { id: string; email: string; role: string; expiresAt: string }[];
  workspaces: { id: string; name: string; role: string }[];
  currentWorkspaceId: string;
}

const PLATFORMS: [string, string][] = [['youtube', 'YouTube'], ['instagram', 'Instagram'], ['tiktok', 'TikTok'], ['linkedin', 'LinkedIn'], ['twitter', 'X']];

export function SettingsView({ data, onRefresh }: Props) {
  const isAdmin = data.user.role !== 'member';
  const s = data.settings;

  const [workspaceName, setWorkspaceName] = useState(data.workspace.name);
  const [brandName, setBrandName] = useState(s.brandName);
  const [brandNiche, setBrandNiche] = useState(s.brandNiche);
  const [brandTone, setBrandTone] = useState(s.brandTone);
  const [audience, setAudience] = useState(s.targetAudience);
  const [language, setLanguage] = useState(s.defaultLanguage);
  const [captionStyle, setCaptionStyle] = useState(s.captionStyle);
  const [platforms, setPlatforms] = useState<string[]>(s.defaultPlatforms);
  const [retention, setRetention] = useState(data.workspace.retentionDays);
  const retentionOptions = Array.from(new Set([7, 14, 30, 60, 90, data.workspace.retentionDays])).sort((a, b) => a - b);
  const [saving, setSaving] = useState(false);
  const [section, setSection] = useState('set-brand');

  const dirty =
    workspaceName !== data.workspace.name || brandName !== s.brandName || brandNiche !== s.brandNiche || brandTone !== s.brandTone ||
    audience !== s.targetAudience || language !== s.defaultLanguage || captionStyle !== s.captionStyle ||
    retention !== data.workspace.retentionDays || [...platforms].sort().join() !== [...s.defaultPlatforms].sort().join();

  const discard = () => {
    setWorkspaceName(data.workspace.name); setBrandName(s.brandName); setBrandNiche(s.brandNiche); setBrandTone(s.brandTone);
    setAudience(s.targetAudience); setLanguage(s.defaultLanguage); setCaptionStyle(s.captionStyle);
    setPlatforms(s.defaultPlatforms); setRetention(data.workspace.retentionDays);
  };

  // Highlight the section in view in the side nav.
  useEffect(() => {
    const ids = ['set-brand', 'set-channel', 'set-members', 'set-account'];
    const els = ids.map((id) => document.getElementById(id)?.closest('section, form')).filter(Boolean) as Element[];
    const io = new IntersectionObserver((entries) => {
      const top = entries.filter((en) => en.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      const id = top?.target.querySelector('h2')?.id;
      if (id) setSection(id);
    }, { rootMargin: '-80px 0px -55% 0px' });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const [members, setMembers] = useState<MembersData | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deletePw, setDeletePw] = useState('');
  const [busy, setBusy] = useState('');

  const loadMembers = useCallback(() => {
    api<MembersData>('/api/workspace/members').then(setMembers).catch(() => {});
  }, []);
  useEffect(loadMembers, [loadMembers]);

  const act = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (err) {
      toast.error(errorMessage(err), { duration: 8000 });
    } finally {
      setBusy('');
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api('/api/settings', {
        body: {
          workspaceName, brandName, brandNiche, brandTone, targetAudience: audience,
          defaultLanguage: language, captionStyle, defaultPlatforms: platforms,
          ...(retention !== data.workspace.retentionDays ? { retentionDays: retention } : {}),
        },
      });
      toast.success('Saved.');
      onRefresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const disconnect = () =>
    act('disconnect', async () => {
      if (!window.confirm('Disconnect your YouTube channel? Viralis will lose access to publish and read stats until you connect again.')) return;
      await api('/api/auth/youtube', { method: 'DELETE' });
      toast.success('YouTube disconnected and access revoked.');
      onRefresh();
    });

  const invite = (e: React.FormEvent) => {
    e.preventDefault();
    act('invite', async () => {
      await api('/api/workspace/members', { body: { email: inviteEmail, role: inviteRole } });
      toast.success(`Invite sent to ${inviteEmail}.`);
      setInviteEmail('');
      loadMembers();
    });
  };

  const removeMember = (body: Record<string, string>, confirmText: string) =>
    act('remove', async () => {
      if (!window.confirm(confirmText)) return;
      await api('/api/workspace/members', { method: 'DELETE', body });
      loadMembers();
    });

  const changeRole = (membershipId: string, role: string) =>
    act('role', async () => {
      await api('/api/workspace/members', { method: 'PATCH', body: { membershipId, role } });
      loadMembers();
    });

  const switchWorkspace = (workspaceId: string) =>
    act('switch', async () => {
      await api('/api/workspace/switch', { body: { workspaceId } });
      window.location.reload();
    });

  const resendVerification = () =>
    act('verify', async () => {
      const res = await api<{ message: string }>('/api/account/verify/resend', { method: 'POST', body: {} });
      toast.success(res.message);
    });

  const changePassword = (e: React.FormEvent) => {
    e.preventDefault();
    act('pw', async () => {
      await api('/api/account/password/change', { body: { current: currentPw, next: newPw } });
      toast.success('Password changed.');
      setCurrentPw('');
      setNewPw('');
    });
  };

  const deleteAccount = (e: React.FormEvent) => {
    e.preventDefault();
    act('delete', async () => {
      await api('/api/account', { method: 'DELETE', body: { confirm: deleteConfirm, password: deletePw } });
      toast.success('Your account was deleted.');
      await signOut({ callbackUrl: '/' });
    });
  };

  const navItems: [string, string, React.ElementType][] = [
    ['set-brand', 'Workspace & brand', Palette], ['set-channel', 'YouTube channel', MonitorPlay], ['set-members', 'Members', Users], ['set-account', 'Your account', UserCircle],
  ];

  return (
    <div className="settings-layout">
      <nav className="settings-nav" aria-label="Settings sections">
        {navItems.map(([id, label, Icon]) => (
          <a key={id} href={`#${id}`} className={section === id ? 'active' : ''} aria-current={section === id ? 'true' : undefined}
            onClick={(e) => { e.preventDefault(); setSection(id); document.getElementById(id)?.closest('section, form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>
            <Icon /> {label}
          </a>
        ))}
      </nav>
      <div className="settings-stack stagger">
      {/* Brand & defaults */}
      <form id="brand-form" className="panel-card settings-section" onSubmit={save} aria-labelledby="set-brand">
        <div className="section-head">
          <span className="section-icon"><Palette /></span>
          <div>
            <h2 id="set-brand" className="section-title">Workspace &amp; brand</h2>
            <p>Used to pick moments and write post captions in your voice.</p>
          </div>
        </div>
        <fieldset disabled={!isAdmin} className="grid-cols-2 settings-fields">
          <div className="form-group"><label className="form-label" htmlFor="s-ws">Workspace name</label><input id="s-ws" className="input-field" value={workspaceName} maxLength={80} onChange={(e) => setWorkspaceName(e.target.value)} /></div>
          <div className="form-group"><label className="form-label" htmlFor="s-brand">Creator / brand name</label><input id="s-brand" className="input-field" value={brandName} maxLength={80} onChange={(e) => setBrandName(e.target.value)} /></div>
          <div className="form-group"><label className="form-label" htmlFor="s-niche">Topic / niche</label><input id="s-niche" className="input-field" value={brandNiche} maxLength={120} placeholder="e.g. JEE physics coaching" onChange={(e) => setBrandNiche(e.target.value)} /></div>
          <div className="form-group"><label className="form-label" htmlFor="s-aud">Audience</label><input id="s-aud" className="input-field" value={audience} maxLength={160} placeholder="e.g. Class 11–12 students" onChange={(e) => setAudience(e.target.value)} /></div>
          <div className="form-group"><label className="form-label" htmlFor="s-tone">Voice</label><input id="s-tone" className="input-field" value={brandTone} maxLength={120} placeholder="e.g. friendly, clear, no hype" onChange={(e) => setBrandTone(e.target.value)} /></div>
          <div className="form-group"><label className="form-label" htmlFor="s-lang">Usual spoken language</label>
            <select id="s-lang" className="input-field" value={language} onChange={(e) => setLanguage(e.target.value)}>{LANGUAGES.map(([c, l]) => <option key={c} value={c}>{l}</option>)}</select>
          </div>
          <div className="form-group"><label className="form-label" htmlFor="s-style">Default caption style</label>
            <select id="s-style" className="input-field" value={captionStyle} onChange={(e) => setCaptionStyle(e.target.value)}>
              <option value="Dynamic Pop">Bold, 3 words at a time</option><option value="Minimalist">Clean lines</option>
            </select>
          </div>
          <div className="form-group"><label className="form-label" htmlFor="s-ret">Delete video files after</label>
            <select id="s-ret" className="input-field" value={retention} onChange={(e) => setRetention(Number(e.target.value))}>
              {retentionOptions.map((d) => <option key={d} value={d} disabled={d > 90 && d !== data.workspace.retentionDays}>{d > 365 ? 'Keep (internal)' : `${d} days`}</option>)}
            </select>
            <span className="text-subtle" style={{ fontSize: '0.7rem' }}>Your plan may keep files for less. Titles, transcripts and captions are kept.</span>
          </div>
          <fieldset className="form-group" style={{ border: 0, gridColumn: '1 / -1' }}>
            <legend className="form-label">Write post captions for</legend>
            <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
              {PLATFORMS.map(([id, label]) => (
                <button key={id} type="button" aria-pressed={platforms.includes(id)} className={`filter-chip ${platforms.includes(id) ? 'active' : ''}`}
                  onClick={() => setPlatforms((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))}>{label}</button>
              ))}
            </div>
          </fieldset>
        </fieldset>
        {isAdmin ? (
          <button type="submit" className="btn btn-primary" disabled={saving || !dirty} style={{ alignSelf: 'flex-start' }}>
            {saving ? <RefreshCw size={14} className="animate-spin" /> : dirty ? <Save size={14} /> : <Check size={14} />} {dirty ? 'Save changes' : 'Saved'}
          </button>
        ) : <p className="text-subtle" style={{ fontSize: '0.75rem' }}>Ask a workspace admin to change these.</p>}
      </form>

      {/* Channel */}
      <section className="panel-card settings-section" aria-labelledby="set-channel">
        <div className="section-head">
          <span className="section-icon neutral"><MonitorPlay /></span>
          <div>
            <h2 id="set-channel" className="section-title">YouTube channel <span className="badge badge-neutral">Optional</span></h2>
            <p>Only needed to publish from Viralis and see how clips perform. You can always download clips and post them yourself.</p>
          </div>
        </div>
        {data.channel.connected ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span className="badge badge-success"><Check size={11} /> Connected{data.channel.title ? ` · ${data.channel.title}` : ''}</span>
            {data.channel.legacy && <span className="text-subtle" style={{ fontSize: '0.72rem' }}>Connected with your own Google Cloud app — reconnect to switch to Viralis’s.</span>}
            {isAdmin && <>
              <form action="/api/auth/youtube" method="get"><button type="submit" className="btn btn-secondary btn-sm"><Link2 size={13} /> Reconnect</button></form>
              <button type="button" className="btn btn-ghost btn-sm" onClick={disconnect} disabled={busy === 'disconnect'}><Unlink size={13} /> Disconnect</button>
            </>}
          </div>
        ) : data.channel.status === 'revoked' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span className="badge badge-danger">Access expired</span>
            {isAdmin && <form action="/api/auth/youtube" method="get"><button type="submit" className="btn btn-primary btn-sm"><Link2 size={13} /> Reconnect YouTube</button></form>}
          </div>
        ) : data.capabilities.youtubeConnect ? (
          isAdmin ? <form action="/api/auth/youtube" method="get" style={{ alignSelf: 'flex-start' }}><button type="submit" className="btn btn-primary btn-sm"><Link2 size={13} /> Connect YouTube</button></form>
            : <p className="text-subtle" style={{ fontSize: '0.75rem' }}>Ask a workspace admin to connect a channel.</p>
        ) : (
          <p className="text-subtle" style={{ fontSize: '0.75rem' }}>Publishing to YouTube isn’t available yet.</p>
        )}
        <p className="text-subtle" style={{ fontSize: '0.72rem' }}>
          Viralis only uploads clips you choose to publish and reads their view and retention stats. You can revoke access anytime here or at{' '}
          <a className="link" href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">Google account permissions</a>.
        </p>
      </section>

      {/* Members */}
      <section className="panel-card settings-section" aria-labelledby="set-members">
        <div className="section-head">
          <span className="section-icon neutral"><Users /></span>
          <div>
            <h2 id="set-members" className="section-title">Members</h2>
            <p>Everyone here shares this workspace’s projects, review queue and channel.</p>
          </div>
        </div>
        {members && members.workspaces.length > 1 && (
          <div className="form-group" style={{ maxWidth: 320 }}>
            <label className="form-label" htmlFor="s-switch">Switch workspace</label>
            <select id="s-switch" className="input-field" value={members.currentWorkspaceId} onChange={(e) => switchWorkspace(e.target.value)}>
              {members.workspaces.map((w) => <option key={w.id} value={w.id}>{w.name} ({w.role})</option>)}
            </select>
          </div>
        )}
        <ul className="member-list">
          {members?.members.map((m) => (
            <li key={m.id}>
              <span className="member-who">
                <span className="member-avatar" aria-hidden="true">{(m.name || m.email || '?')[0].toUpperCase()}</span>
                <span className="truncate">{m.name || m.email}{m.you && <span className="text-subtle"> (you)</span>}<br /><span className="text-subtle" style={{ fontSize: '0.72rem' }}>{m.email}</span></span>
              </span>
              {data.user.role === 'owner' && m.role !== 'owner' ? (
                <select className="input-field select-sm" aria-label={`Role for ${m.email}`} value={m.role} onChange={(e) => changeRole(m.id, e.target.value)}>
                  <option value="admin">Admin</option><option value="member">Member</option>
                </select>
              ) : <span className="badge badge-neutral">{m.role}</span>}
              {m.role !== 'owner' && (isAdmin || m.you) && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeMember({ membershipId: m.id }, m.you ? 'Leave this workspace?' : `Remove ${m.email}?`)}>
                  {m.you ? 'Leave' : 'Remove'}
                </button>
              )}
            </li>
          ))}
          {members?.invites.map((i) => (
            <li key={i.id}>
              <span className="member-who">
                <span className="member-avatar" aria-hidden="true" style={{ borderStyle: 'dashed', background: 'transparent' }}><Mail size={12} /></span>
                <span className="truncate">{i.email}<br /><span className="text-subtle" style={{ fontSize: '0.72rem' }}>Invited · {i.role}</span></span>
              </span>
              <span className="badge badge-warning">Pending</span>
              {isAdmin && <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeMember({ inviteId: i.id }, `Revoke the invite for ${i.email}?`)}>Revoke</button>}
            </li>
          ))}
        </ul>
        {isAdmin && (
          <form onSubmit={invite} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: '1 1 220px' }}>
              <label className="form-label" htmlFor="s-inv">Invite by email</label>
              <input id="s-inv" type="email" className="input-field" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="teammate@example.com" />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="s-inv-role">Role</label>
              <select id="s-inv-role" className="input-field" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
                <option value="member">Member — make clips</option>
                {data.user.role === 'owner' && <option value="admin">Admin — also settings &amp; channel</option>}
              </select>
            </div>
            <button type="submit" className="btn btn-secondary" disabled={!inviteEmail || busy === 'invite'}><UserPlus size={14} /> Invite</button>
          </form>
        )}
      </section>

      {/* Account */}
      <section className="panel-card settings-section" aria-labelledby="set-account">
        <div className="section-head">
          <span className="section-icon neutral"><UserCircle /></span>
          <div>
            <h2 id="set-account" className="section-title">Your account</h2>
            <p>Sign-in, your data, and deleting your account.</p>
          </div>
        </div>
        <p style={{ fontSize: '0.85rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <Mail size={14} /> {data.user.email}
          {data.user.emailVerified ? <span className="badge badge-success">Verified</span> : (
            <>
              <span className="badge badge-warning">Not verified</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={resendVerification} disabled={busy === 'verify'}>Resend email</button>
            </>
          )}
        </p>

        <form onSubmit={changePassword} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group"><label className="form-label" htmlFor="pw-cur">Current password</label><input id="pw-cur" type="password" autoComplete="current-password" className="input-field" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} /></div>
          <div className="form-group"><label className="form-label" htmlFor="pw-new">New password</label><input id="pw-new" type="password" autoComplete="new-password" minLength={10} className="input-field" value={newPw} onChange={(e) => setNewPw(e.target.value)} /></div>
          <button type="submit" className="btn btn-secondary" disabled={newPw.length < 10 || busy === 'pw'}><KeyRound size={14} /> Change password</button>
        </form>
        <p className="text-subtle" style={{ fontSize: '0.7rem' }}>Signed in with Google and never set a password? Leave “current password” empty.</p>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <a className="btn btn-ghost btn-sm" href="/api/account/export"><Download size={13} /> Export my data</a>
        </div>

        <details className="danger-zone">
          <summary>Delete account</summary>
          <form onSubmit={deleteAccount} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.6rem' }}>
            <p className="text-muted" style={{ fontSize: '0.8rem' }}>
              Permanently deletes your account. Workspaces only you belong to are deleted with all their recordings, clips and files, any subscription is canceled immediately, and your YouTube access is revoked. This can’t be undone.
            </p>
            <div className="form-group"><label className="form-label" htmlFor="del-pw">Password (if you have one)</label><input id="del-pw" type="password" autoComplete="current-password" className="input-field" value={deletePw} onChange={(e) => setDeletePw(e.target.value)} /></div>
            <div className="form-group"><label className="form-label" htmlFor="del-confirm">Type DELETE to confirm</label><input id="del-confirm" className="input-field" value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} /></div>
            <button type="submit" className="btn btn-danger" disabled={deleteConfirm !== 'DELETE' || busy === 'delete'} style={{ alignSelf: 'flex-start' }}><Trash2 size={14} /> Delete my account</button>
          </form>
        </details>
      </section>

      {isAdmin && dirty && (
        <div className="save-bar" role="status">
          <p>You have unsaved changes</p>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={discard} disabled={saving}>Discard</button>
            <button type="submit" form="brand-form" className="btn btn-primary btn-sm" disabled={saving}>
              {saving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />} Save changes
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
