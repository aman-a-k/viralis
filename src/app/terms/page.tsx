import { LegalPage, BUSINESS } from '@/components/LegalPage';
import { PLANS } from '@/lib/plans';

export const metadata = { title: 'Terms of Service — Viralis' };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <p>These terms govern your use of {BUSINESS.name} (“the service”), operated by {BUSINESS.operator}, {BUSINESS.city} (“we”, “us”). By creating an account you agree to them.</p>

      <h2>1. What the service does</h2>
      <p>You upload recordings (or link videos you have the right to use). The service transcribes them, suggests short clips, lets you edit captions and framing, and produces video files you can download or, if you connect a YouTube channel, publish. Suggestions and scores are automated editorial judgments — we don’t promise any number of views, followers or earnings.</p>

      <h2>2. Your account</h2>
      <p>You must be at least 18, or have a parent or guardian’s consent, and give accurate information. Keep your password safe; you’re responsible for activity in your account and workspace. Workspace owners control who else has access.</p>

      <h2>3. Your content</h2>
      <p>You keep all rights to what you upload and the clips you make. You give us permission to store and process your content only to provide the service to you (transcription, analysis, rendering, publishing at your request). You confirm you own your content or have permission to use it, and that it follows our <a href="/content-policy">content policy</a>.</p>

      <h2>4. Plans, payment and limits</h2>
      <p>The free trial includes {PLANS.trial.sourceMinutes} minutes of recordings and {PLANS.trial.exports} exports, once per account. Paid plans renew monthly until canceled and include the processing minutes and exports shown on the pricing page; unused allowance doesn’t carry over. Prices are in Indian rupees and exclude applicable taxes. Payments are processed by Razorpay. See <a href="/refunds">refunds &amp; cancellation</a>.</p>

      <h2>5. Storage and deletion</h2>
      <p>Uploaded recordings and exported videos are deleted automatically after your plan’s retention period (or sooner if you choose). Download anything you want to keep. Transcripts, captions and clip details remain until you delete the project or your account.</p>

      <h2>6. Acceptable use</h2>
      <p>Don’t misuse the service: no illegal content, content you don’t have rights to, attempts to access other users’ data, overloading or reverse-engineering the service, or reselling it without permission. We may suspend accounts that do.</p>

      <h2>7. Third-party services</h2>
      <p>Publishing uses YouTube’s API; by connecting a channel you also agree to the <a href="https://www.youtube.com/t/terms" target="_blank" rel="noreferrer">YouTube Terms of Service</a>. You can revoke our access at any time.</p>

      <h2>8. Availability and liability</h2>
      <p>We work to keep the service running and your data safe, but provide it “as is”. To the extent the law allows, our total liability for any claim is limited to the fees you paid us in the 3 months before it arose, and we aren’t liable for indirect losses such as lost revenue or reach.</p>

      <h2>9. Ending your account</h2>
      <p>You can delete your account anytime in Settings; this deletes your workspaces’ data as described in our <a href="/privacy">privacy policy</a>. We may end the service with 30 days’ notice and a pro-rated refund of any prepaid period.</p>

      <h2>10. Changes and law</h2>
      <p>We’ll notify you by email of material changes at least 14 days before they apply. These terms are governed by the laws of India, with courts in Mangaluru, Karnataka having jurisdiction.</p>

      <p>Questions: <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a></p>
    </LegalPage>
  );
}
