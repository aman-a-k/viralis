import { LegalPage, BUSINESS } from '@/components/LegalPage';

export const metadata = { title: 'Refunds & Cancellation — Viralis' };

export default function RefundsPage() {
  return (
    <LegalPage title="Refunds & Cancellation">
      <h2>Cancelling</h2>
      <p>You can cancel anytime from Billing. Your plan stays active until the end of the period you’ve already paid for, and you won’t be charged again. There are no cancellation fees.</p>

      <h2>Refunds</h2>
      <ul>
        <li><strong>First payment:</strong> if the service doesn’t work for you, ask within 7 days of your first payment and we’ll refund it in full, as long as you’ve used less than half of that month’s allowance.</li>
        <li><strong>Service failures:</strong> processing that fails on our side is never charged — the minutes or export are returned to your allowance automatically. If a failure cost you a paid period, contact us and we’ll credit or refund it.</li>
        <li><strong>Duplicate or mistaken charges</strong> are refunded in full.</li>
        <li>Otherwise, payments for a period that has started aren’t refundable, but you keep access until it ends.</li>
      </ul>
      <p>Approved refunds go back to the original payment method through Razorpay, usually within 5–7 working days.</p>

      <h2>Failed renewals</h2>
      <p>If a renewal payment fails, Razorpay retries it for a few days and you keep access meanwhile. If it keeps failing, the subscription pauses and your workspace returns to no plan until you subscribe again. Your projects are kept (files follow the normal retention period).</p>

      <p>Refund requests: <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a> or {BUSINESS.phone}.</p>
    </LegalPage>
  );
}
