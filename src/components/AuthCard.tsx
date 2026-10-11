import React from 'react';
import Link from 'next/link';
import { BrandMark } from './BrandMark';

/** Centered card layout shared by the small auth pages. */
export function AuthCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="center-screen" style={{ padding: '1.5rem' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.5rem', justifyContent: 'center' }}>
          <BrandMark size={30} />
          <span style={{ fontSize: '1.2rem', fontWeight: 700 }}>Viralis</span>
        </Link>
        <div className="panel-card" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          <h1 style={{ fontSize: '1.2rem', fontWeight: 700 }}>{title}</h1>
          {children}
        </div>
      </div>
    </div>
  );
}
