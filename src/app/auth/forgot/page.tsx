"use client";

import React, { useState } from 'react';
import { AuthCard } from '@/components/AuthCard';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    await fetch('/api/account/password/forgot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) }).catch(() => {});
    setBusy(false);
    setSent(true);
  };

  return (
    <AuthCard title="Reset your password">
      {sent ? (
        <p className="text-muted" style={{ fontSize: '0.875rem' }} role="status">
          If an account exists for <strong>{email}</strong>, we’ve sent a link to choose a new password. It works for 1 hour. Check your spam folder if it doesn’t arrive.
        </p>
      ) : (
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <p className="text-muted" style={{ fontSize: '0.8125rem' }}>Enter your account’s email and we’ll send you a reset link.</p>
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email</label>
            <input id="email" type="email" required autoComplete="email" className="input-field" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={busy}>Send reset link</button>
        </form>
      )}
      <a href="/auth/signin" className="link" style={{ fontSize: '0.8rem' }}>Back to sign in</a>
    </AuthCard>
  );
}
