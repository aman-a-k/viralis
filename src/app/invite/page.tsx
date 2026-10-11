"use client";

import React, { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { AuthCard } from '@/components/AuthCard';

function Accept() {
  const token = useSearchParams().get('token') || '';
  const { status } = useSession();
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (status === 'loading') return <p className="text-muted">Loading…</p>;
  if (status !== 'authenticated') {
    const back = encodeURIComponent(`/invite?token=${encodeURIComponent(token)}`);
    return (
      <>
        <p className="text-muted" style={{ fontSize: '0.875rem' }}>Sign in (or create an account) with the email address the invite was sent to, then come back to this link.</p>
        <a className="btn btn-primary" href={`/auth/signin?mode=signup&callbackUrl=${back}`}>Create account</a>
        <a className="btn btn-secondary" href={`/auth/signin?callbackUrl=${back}`}>I already have an account</a>
      </>
    );
  }

  const accept = async () => {
    setBusy(true);
    const res = await fetch('/api/invites/accept', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (data.success) router.push('/');
    else setError(data.error || 'Could not accept the invite.');
  };

  return (
    <>
      <p className="text-muted" style={{ fontSize: '0.875rem' }}>You’ve been invited to collaborate in a Viralis workspace.</p>
      {error && <p className="inline-error" role="alert">{error}</p>}
      <button type="button" className="btn btn-primary" onClick={accept} disabled={busy || !token}>Join workspace</button>
    </>
  );
}

export default function InvitePage() {
  return (
    <AuthCard title="Join a workspace">
      <Suspense fallback={null}><Accept /></Suspense>
    </AuthCard>
  );
}
