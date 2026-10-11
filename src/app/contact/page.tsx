import { LegalPage, BUSINESS } from '@/components/LegalPage';

export const metadata = { title: 'Contact — Viralis' };

export default function ContactPage() {
  return (
    <LegalPage title="Contact & support">
      <p>We’re a small team and answer every message, usually within one working day.</p>
      <ul>
        <li>Email: <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a></li>
        <li>Address: {BUSINESS.operator}, {BUSINESS.city}</li>
      </ul>
      <p>For a problem with a clip or project, include the project name and roughly when it happened so we can find it quickly.</p>
    </LegalPage>
  );
}
