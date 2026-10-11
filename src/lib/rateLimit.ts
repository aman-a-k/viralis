import { prisma } from './prisma';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES_PER_EMAIL = 8;
const MAX_FAILURES_PER_IP = 30;

/**
 * Sign-in throttling: too many failed attempts for one email (or from one
 * IP) in 15 minutes blocks further attempts until the window passes. Stored
 * in the database so it holds across serverless instances.
 */
export async function isLoginBlocked(email: string, ip: string): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MS);
  const [byEmail, byIp] = await Promise.all([
    prisma.loginAttempt.count({ where: { key: `email:${email}`, success: false, createdAt: { gte: since } } }),
    prisma.loginAttempt.count({ where: { key: `ip:${ip}`, success: false, createdAt: { gte: since } } }),
  ]);
  return byEmail >= MAX_FAILURES_PER_EMAIL || byIp >= MAX_FAILURES_PER_IP;
}

export async function recordLoginAttempt(email: string, ip: string, success: boolean) {
  await prisma.loginAttempt.createMany({
    data: [
      { key: `email:${email}`, success },
      { key: `ip:${ip}`, success },
    ],
  });
  if (success) {
    // A successful sign-in clears that account's failure streak.
    await prisma.loginAttempt.deleteMany({ where: { key: `email:${email}`, success: false } });
  }
}

/**
 * Generic fixed-window limiter for unauthenticated endpoints (sign-up,
 * password-reset requests). Reuses the LoginAttempt table with its own key.
 */
export async function hitRateLimit(key: string, max: number, windowMs = WINDOW_MS): Promise<boolean> {
  const since = new Date(Date.now() - windowMs);
  const count = await prisma.loginAttempt.count({ where: { key, createdAt: { gte: since } } });
  if (count >= max) return true;
  await prisma.loginAttempt.create({ data: { key, success: false } });
  return false;
}

export async function pruneLoginAttempts() {
  await prisma.loginAttempt.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } });
}
