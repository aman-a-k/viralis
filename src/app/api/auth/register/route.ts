import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { canCreateAccount } from "@/lib/signupPolicy";
import { hitRateLimit } from "@/lib/rateLimit";
import { clientIp } from "@/lib/http";
import { ensurePersonalWorkspace, audit } from "@/lib/workspace";
import { sendVerificationEmail } from "@/lib/authTokens";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  try {
    const ip = clientIp(req);
    if (await hitRateLimit(`signup:${ip}`, 10, 60 * 60 * 1000)) {
      return NextResponse.json({ success: false, error: "Too many sign-ups from this network. Try again later." }, { status: 429 });
    }

    const { email, password, name, acceptTerms } = await req.json();

    if (typeof email !== "string" || !EMAIL_RE.test(email.trim()) || email.length > 254) {
      return NextResponse.json({ success: false, error: "Enter a valid email address." }, { status: 400 });
    }
    if (typeof password !== "string" || password.length < 10 || password.length > 200) {
      return NextResponse.json({ success: false, error: "Use a password of at least 10 characters." }, { status: 400 });
    }
    if (acceptTerms !== true) {
      return NextResponse.json({ success: false, error: "Please accept the Terms and Privacy Policy." }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    if (!(await canCreateAccount(normalizedEmail))) {
      return NextResponse.json({ success: false, error: "Sign-up is invite-only right now." }, { status: 403 });
    }

    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      // Includes accounts created through Google: setting a password on one
      // here would let anyone who knows the email take it over.
      return NextResponse.json(
        { success: false, error: "An account with this email already exists. Sign in instead, or reset your password." },
        { status: 409 }
      );
    }

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash: await bcrypt.hash(password, 12),
        name: typeof name === "string" && name.trim() ? name.trim().slice(0, 100) : null,
      },
    });
    await ensurePersonalWorkspace(user.id, user.name);
    await audit({ userId: user.id }, "account.create", { method: "password" }, ip);

    let emailSent = true;
    try {
      await sendVerificationEmail({ id: user.id, email: normalizedEmail, name: user.name });
    } catch (err) {
      emailSent = false;
      console.error("[register] verification email failed", err);
    }
    return NextResponse.json({ success: true, userId: user.id, emailSent });
  } catch (error) {
    console.error("[API /api/auth/register] Error:", error);
    return NextResponse.json({ success: false, error: "Could not create account." }, { status: 500 });
  }
}
