import { prisma } from "./prisma";

// Viralis is a single workspace: every signed-in user shares the same
// projects, queue, and Settings (including API keys and the connected
// YouTube account). So new accounts must be invite-only.
//
// ALLOWED_EMAILS (comma-separated) lists who may create an account. If it's
// unset, only the very first account can be created (owner bootstrap) and
// sign-up closes after that.

function allowlist(): string[] {
  return (process.env.ALLOWED_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export async function canCreateAccount(email: string): Promise<boolean> {
  const list = allowlist();
  if (list.length) return list.includes(email.trim().toLowerCase());
  return (await prisma.user.count()) === 0;
}

export async function isSignupOpen(): Promise<boolean> {
  if (allowlist().length) return true;
  return (await prisma.user.count()) === 0;
}
