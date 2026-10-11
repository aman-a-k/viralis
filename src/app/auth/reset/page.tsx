"use client";

import React, { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AuthCard } from '@/components/AuthCard';

function ResetForm() {
  const token = useSearchParams().get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) return setError('The passwords don’t match.');
    setBusy(true);
    setError('');
    const res = await fetch('/api/account/password/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password }) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (data.success) setDone(true);
    else setError(data.error || 'Could not reset the password.');
  };

  if (done) {
    return (
      <>
        <p className="text-muted" role="status" style={{ fontSize: '0.875rem' }}>Your password was changed.</p>
        <a href="/auth/signin" className="btn btn-primary">Sign in</a>
      </>
    );
  }
  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div className="form-group">
        <label className="form-label" htmlFor="pw">New password</label>
        <input id="pw" type="password" required minLength={10} autoComplete="new-password" className="input-field" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="pw2">Repeat it</label>
        <input id="pw2" type="password" required minLength={10} autoComplete="new-password" className="input-field" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </div>
      {error && <p className="inline-error" role="alert">{error}</p>}
      <button type="submit" className="btn btn-primary" disabled={busy || !token}>Save new password</button>
      {!token && <p className="inline-error">This link is missing its token. Request a new one.</p>}
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthCard title="Choose a new password">
      <Suspense fallback={null}><ResetForm /></Suspense>
    </AuthCard>
  );
}
