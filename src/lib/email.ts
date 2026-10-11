/**
 * Transactional email via Resend (https://resend.com) — set RESEND_API_KEY
 * and EMAIL_FROM (an address on a domain verified in Resend).
 *
 * Without a key, development logs the message (so links can be clicked from
 * the terminal) and production refuses, so a missing setup can't silently
 * swallow password-reset emails.
 */
export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export function appUrl(): string {
  return (process.env.APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '');
}

export function supportEmail(): string {
  return process.env.SUPPORT_EMAIL || process.env.EMAIL_FROM?.replace(/^.*<|>.*$/g, '') || 'support@example.com';
}

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function layout(heading: string, body: string, cta?: { label: string; url: string }) {
  return `<!doctype html><html><body style="margin:0;background:#f6f7f9;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#111">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="100%" style="max-width:520px;background:#fff;border-radius:12px;padding:32px" cellpadding="0" cellspacing="0"><tr><td>
<p style="font-weight:700;font-size:15px;margin:0 0 24px">Viralis</p>
<h1 style="font-size:20px;margin:0 0 12px">${escape(heading)}</h1>
<div style="font-size:15px;line-height:1.55;color:#333">${body}</div>
${cta ? `<p style="margin:28px 0"><a href="${escape(cta.url)}" style="background:#111;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;display:inline-block">${escape(cta.label)}</a></p>
<p style="font-size:12px;color:#777;word-break:break-all">Or paste this link into your browser: ${escape(cta.url)}</p>` : ''}
<p style="font-size:12px;color:#777;margin-top:28px">Questions? Reply to this email or write to ${escape(supportEmail())}.</p>
</td></tr></table></td></tr></table></body></html>`;
}

export async function sendEmail(to: string, subject: string, heading: string, bodyHtml: string, cta?: { label: string; url: string }) {
  if (!emailConfigured()) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Email delivery is not configured (RESEND_API_KEY / EMAIL_FROM).');
    }
    console.log(`\n[email:dev] To: ${to}\nSubject: ${subject}\n${cta ? `${cta.label}: ${cta.url}\n` : ''}`);
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [to],
      subject,
      html: layout(heading, bodyHtml, cta),
      reply_to: supportEmail(),
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Email send failed (HTTP ${res.status}) ${detail.slice(0, 200)}`);
  }
}

export { escape as escapeHtml };
