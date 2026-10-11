import { LegalPage, BUSINESS } from '@/components/LegalPage';

export const metadata = { title: 'Privacy Policy — Viralis' };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>This explains what {BUSINESS.name} collects, why, and the choices you have. We act in line with India’s Digital Personal Data Protection Act, 2023.</p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Account:</strong> name, email, password (stored only as a one-way hash), or your Google profile if you sign in with Google.</li>
        <li><strong>Your content:</strong> recordings you upload or link, their transcripts, the clips, captions and publishing details you create.</li>
        <li><strong>YouTube (only if you connect a channel):</strong> an access token that lets us upload the clips you choose and read their view and retention statistics. It’s encrypted at rest.</li>
        <li><strong>Billing:</strong> your plan and subscription status from Razorpay. We never see or store card or bank details.</li>
        <li><strong>Security logs:</strong> sign-in attempts, IP address and important account actions, to protect your account.</li>
      </ul>

      <h2>How we use it</h2>
      <p>Only to run the service for you: transcribe and analyze your recordings, render clips, publish when you ask, show you performance, bill you, keep the service secure, and contact you about your account. We don’t sell your data or use your recordings to advertise.</p>

      <h2>Who processes it for us</h2>
      <ul>
        <li>Vercel (hosting and file storage) and our database host, to store your data.</li>
        <li>Our media-processing server, which transcribes and renders your recordings.</li>
        <li>An AI model provider (currently Google Gemini via its API), which receives transcript text to suggest clips and write captions.</li>
        <li>Google / YouTube, when you connect a channel or sign in with Google.</li>
        <li>Razorpay, for payments; Resend, to send account emails.</li>
      </ul>
      <p>These providers may process data outside India under their own security commitments.</p>

      <h2>How long we keep it</h2>
      <p>Uploaded recordings and exported videos are deleted automatically after your plan’s retention period (7–60 days depending on plan, or shorter if you choose in Settings). Project details, transcripts and captions are kept until you delete the project or your account. Security logs are kept for up to 1 year.</p>

      <h2>Your rights and choices</h2>
      <ul>
        <li>Download your data anytime (Settings → Export my data).</li>
        <li>Delete a project, or your whole account (Settings → Delete account), which deletes your workspace’s data and revokes YouTube access.</li>
        <li>Disconnect YouTube anytime in Settings or at <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">Google account permissions</a>.</li>
        <li>Ask us to correct your information, or raise a concern with our grievance contact below.</li>
      </ul>

      <h2>Google API data</h2>
      <p>Viralis’s use of information received from Google APIs adheres to the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">Google API Services User Data Policy</a>, including the Limited Use requirements. YouTube data is used only to publish your clips and show you their performance.</p>

      <h2>Security</h2>
      <p>Each workspace’s data is isolated from others, files are stored privately and only reachable through short-lived signed links, and third-party tokens are encrypted. No system is perfectly secure; if a breach affects you we’ll tell you promptly.</p>

      <h2>Grievance officer and contact</h2>
      <p>{BUSINESS.operator}, {BUSINESS.city} · <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a> · {BUSINESS.phone}. We respond within 7 days.</p>
    </LegalPage>
  );
}
