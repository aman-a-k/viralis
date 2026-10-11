import { prisma } from "./prisma";

// Each account gets its own isolated workspace, so sign-up is open by
// default. SIGNUP_MODE=invite restricts it to ALLOWED_EMAILS (plus anyone
// with a pending workspace invite) — useful for a closed pilot.

function allowlist(): string[] {
  return (process.env.ALLOWED_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function signupMode(): "open" | "invite" {
  return process.env.SIGNUP_MODE === "invite" ? "invite" : "open";
}

export async function canCreateAccount(email: string): Promise<boolean> {
  if (signupMode() === "open") return true;
  const normalized = email.trim().toLowerCase();
  if (allowlist().includes(normalized)) return true;
  const invite = await prisma.invite.findFirst({
    where: { email: normalized, acceptedAt: null, expiresAt: { gt: new Date() } },
  });
  return !!invite;
}

export async function isSignupOpen(): Promise<boolean> {
  return signupMode() === "open" || allowlist().length > 0;
}
