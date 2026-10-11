import { describe, it, expect, beforeAll } from 'vitest';
import { createHmac } from 'node:crypto';
import { encryptSecret, decryptSecret, sha256, safeEqual } from '@/lib/crypto';
import { verifyWebhookSignature } from '@/services/billing';

beforeAll(() => {
  process.env.ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
  process.env.RAZORPAY_WEBHOOK_SECRET = 'whsec_test';
});

describe('secret encryption', () => {
  it('round-trips and never stores plaintext', () => {
    const enc = encryptSecret('1//refresh-token');
    expect(enc).not.toContain('refresh');
    expect(decryptSecret(enc)).toBe('1//refresh-token');
  });
  it('uses a fresh IV each time', () => {
    expect(encryptSecret('x')).not.toBe(encryptSecret('x'));
  });
  it('rejects tampered ciphertext', () => {
    const enc = encryptSecret('secret');
    const parts = enc.split(':');
    parts[3] = Buffer.from('tampered').toString('base64url');
    expect(() => decryptSecret(parts.join(':'))).toThrow();
  });
  it('reads values carried over by the migration', () => {
    expect(decryptSecret('plain:abc')).toBe('abc');
  });
  it('hashes and compares tokens', () => {
    expect(sha256('a')).toHaveLength(64);
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
  });
});

describe('Razorpay webhook signature', () => {
  const body = JSON.stringify({ event: 'subscription.activated' });
  it('accepts the provider signature', () => {
    const sig = createHmac('sha256', 'whsec_test').update(body).digest('hex');
    expect(verifyWebhookSignature(body, sig)).toBe(true);
  });
  it('rejects a forged or missing signature', () => {
    expect(verifyWebhookSignature(body, 'deadbeef')).toBe(false);
    expect(verifyWebhookSignature(body, null)).toBe(false);
    const other = createHmac('sha256', 'wrong').update(body).digest('hex');
    expect(verifyWebhookSignature(body, other)).toBe(false);
  });
});
