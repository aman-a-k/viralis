import { prisma } from './prisma';
import { randomToken, sha256 } from './crypto';
import { appUrl, sendEmail, escapeHtml } from './email';

export type TokenPurpose = 'verify_email' | 'reset_password';

const TTL_MS: Record<TokenPurpose, number> = {
  verify_email: 48 * 60 * 60 * 1000,
  reset_password: 60 * 60 * 1000,
};

/** Issues a single-use token (only its hash is stored); older ones for the same purpose stop working. */
export async function issueToken(userId: string, purpose: TokenPurpose): Promise<string> {
  const token = randomToken();
  await prisma.$transaction([
    prisma.authToken.updateMany({ where: { userId, purpose, usedAt: null }, data: { usedAt: new Date() } }),
    prisma.authToken.create({ data: { userId, purpose, tokenHash: sha256(token), expiresAt: new Date(Date.now() + TTL_MS[purpose]) } }),
  ]);
  return token;
}

/** Consumes a token; returns its user id, or null if invalid/expired/used. */
export async function consumeToken(token: string, purpose: TokenPurpose): Promise<string | null> {
  if (!token || token.length > 200) return null;
  const row = await prisma.authToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!row || row.purpose !== purpose || row.usedAt || row.expiresAt < new Date()) return null;
  const res = await prisma.authToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
  return res.count ? row.userId : null;
}

export async function sendVerificationEmail(user: { id: string; email: string; name?: string | null }) {
  const token = await issueToken(user.id, 'verify_email');
  await sendEmail(
    user.email,
    'Confirm your email for Viralis',
    'Confirm your email',
    `<p>Hi${user.name ? ` ${escapeHtml(user.name)}` : ''},</p><p>Confirm this address to start turning your recordings into clips. The link works for 48 hours.</p>`,
    { label: 'Confirm email', url: `${appUrl()}/api/account/verify?token=${encodeURIComponent(token)}` }
  );
}

export async function sendPasswordResetEmail(user: { id: string; email: string }) {
  const token = await issueToken(user.id, 'reset_password');
  await sendEmail(
    user.email,
    'Reset your Viralis password',
    'Reset your password',
    '<p>Someone (hopefully you) asked to reset the password for this account. The link works for 1 hour. If it wasn’t you, ignore this email — your password won’t change.</p>',
    { label: 'Choose a new password', url: `${appUrl()}/auth/reset?token=${encodeURIComponent(token)}` }
  );
}
