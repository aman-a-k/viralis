import React from 'react';
import Link from 'next/link';
import { BrandMark } from './BrandMark';

export const BUSINESS = {
  name: 'Viralis',
  operator: process.env.LEGAL_OPERATOR_NAME || 'Aman A K',
  city: 'Mangaluru, Karnataka, India',
  email: process.env.SUPPORT_EMAIL || 'support@example.com',
  phone: '+91 93427 39999',
  updated: '11 October 2026',
};

export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="legal">
      <header className="legal-head">
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <BrandMark size={24} /> <strong>Viralis</strong>
        </Link>
      </header>
      <main className="legal-body">
        <h1>{title}</h1>
        <p className="text-subtle">Last updated {BUSINESS.updated}</p>
        {children}
      </main>
      <footer className="landing-footer">
        <nav aria-label="Legal" className="footer-links">
          <a href="/terms">Terms</a>
          <a href="/privacy">Privacy</a>
          <a href="/refunds">Refunds &amp; cancellation</a>
          <a href="/content-policy">Content policy</a>
          <a href="/contact">Contact</a>
        </nav>
      </footer>
    </div>
  );
}
