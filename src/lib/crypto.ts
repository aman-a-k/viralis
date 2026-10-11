import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Application-level encryption for third-party credentials (OAuth refresh
 * tokens). AES-256-GCM with a key from ENCRYPTION_KEY (32 bytes, base64).
 *
 * Stored format: "v1:<iv>:<tag>:<ciphertext>" (base64url parts). Values the
 * database migration carried over from the single-tenant era are stored as
 * "plain:<value>"; they still decrypt, and callers re-encrypt them on use.
 */

function key(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ENCRYPTION_KEY is not set. Generate one with `openssl rand -base64 32`.');
    }
    // Development only: a fixed, obviously-insecure key so local setups work.
    return createHash('sha256').update('viralis-dev-only-key').digest();
  }
  const buf = Buffer.from(raw, 'base64');
  if (buf.length !== 32) throw new Error('ENCRYPTION_KEY must be 32 bytes, base64-encoded.');
  return buf;
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64url'), tag.toString('base64url'), ct.toString('base64url')].join(':');
}

export function decryptSecret(stored: string): string {
  if (stored.startsWith('plain:')) return stored.slice('plain:'.length);
  const [version, iv, tag, ct] = stored.split(':');
  if (version !== 'v1' || !iv || !tag || !ct) throw new Error('Unrecognized encrypted value.');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ct, 'base64url')), decipher.final()]).toString('utf8');
}

export function isLegacyPlaintext(stored: string | null | undefined): boolean {
  return !!stored && stored.startsWith('plain:');
}

/** URL-safe random token for emails/links. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
