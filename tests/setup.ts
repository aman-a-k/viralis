import { vi } from 'vitest';

// Route handlers resolve the caller through next-auth's getServerSession;
// tests set `testSession.userId` to act as a given user (null = signed out).
export const testSession: { userId: string | null } = { userId: null };

vi.mock('next-auth', async (orig) => {
  const actual = await orig<typeof import('next-auth')>();
  return {
    ...actual,
    getServerSession: vi.fn(async () => (testSession.userId ? { user: { id: testSession.userId } } : null)),
  };
});

vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }));

// Background work (after()) only runs when a test drives it explicitly.
vi.mock('next/server', async (orig) => {
  const actual = await orig<typeof import('next/server')>();
  return { ...actual, after: vi.fn() };
});
