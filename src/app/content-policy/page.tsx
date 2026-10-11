import { LegalPage, BUSINESS } from '@/components/LegalPage';

export const metadata = { title: 'Content Policy — Viralis' };

export default function ContentPolicyPage() {
  return (
    <LegalPage title="Content Policy">
      <h2>Use content you have rights to</h2>
      <p>Only upload or link recordings you made, or that the rights holder has allowed you to reuse and edit. Trending videos shown in Viralis are for research and inspiration — making clips from someone else’s video without permission can infringe their copyright, and YouTube may refuse to monetize or may remove reused content even when you do have permission.</p>

      <h2>Not allowed</h2>
      <ul>
        <li>Content that infringes copyright or other rights.</li>
        <li>Sexual content involving minors, or any content that exploits children.</li>
        <li>Content that promotes violence, terrorism, or hatred against people for who they are.</li>
        <li>Harassment, doxxing, or sharing someone’s private information without consent.</li>
        <li>Deceptive content, such as impersonation or realistic synthetic media presented as real without disclosure.</li>
        <li>Anything illegal in India or where you publish.</li>
      </ul>

      <h2>Publishing responsibly</h2>
      <p>When you publish, you choose the audience settings and declare whether a clip is made for kids or contains realistic AI-generated or altered content. Answer these accurately — they’re your legal responsibility on YouTube.</p>

      <h2>Reporting</h2>
      <p>If you believe content processed with Viralis infringes your rights, write to <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a> with details. We act on valid notices and may suspend accounts that repeatedly violate this policy.</p>
    </LegalPage>
  );
}
