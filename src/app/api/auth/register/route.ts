import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { canCreateAccount } from "@/lib/signupPolicy";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  try {
    const { email, password, name } = await req.json();

    if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
      return NextResponse.json({ success: false, error: "Enter a valid email address." }, { status: 400 });
    }

    if (typeof password !== "string" || password.length < 8 || password.length > 200) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    if (!(await canCreateAccount(normalizedEmail))) {
      return NextResponse.json(
        { success: false, error: "Sign-up is invite-only. Ask the workspace owner to add your email." },
        { status: 403 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      // Includes accounts created through Google: setting a password on one
      // here would let anyone who knows the email take it over.
      return NextResponse.json(
        { success: false, error: "An account with this email already exists. Sign in instead." },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        name: typeof name === "string" && name.trim() ? name.trim().slice(0, 100) : null,
      },
    });

    return NextResponse.json({ success: true, userId: user.id });
  } catch (error) {
    console.error("[API /api/auth/register] Error:", error);
    return NextResponse.json({ success: false, error: "Could not create account." }, { status: 500 });
  }
}
