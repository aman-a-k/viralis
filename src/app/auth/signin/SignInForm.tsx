"use client";

import React, { useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { ArrowRight, Loader2 } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";

interface Props {
  devLoginAvailable: boolean;
  googleLoginAvailable: boolean;
  signupOpen: boolean;
}

export function SignInForm({ devLoginAvailable, googleLoginAvailable, signupOpen }: Props) {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const [mode, setMode] = useState<"signin" | "signup">(searchParams.get("mode") === "signup" ? "signup" : "signin");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  // NextAuth redirects back here with ?error=AccessDenied when the signIn
  // callback rejects a Google account that isn't allowed to join.
  const authError = searchParams.get("error");
  React.useEffect(() => {
    if (authError === "AccessDenied") {
      toast.error("Sign-up is invite-only right now.", { id: "auth-error" });
    } else if (authError === "OAuthAccountNotLinked") {
      toast.error("This email already has a password account. Sign in with your password.", { id: "auth-error", duration: 8000 });
    } else if (authError) {
      toast.error("Sign-in failed. Please try again.", { id: "auth-error" });
    }
  }, [authError]);

  const finish = (res: { error?: string | null; ok?: boolean } | undefined) => {
    if (res?.error) {
      toast.error(
        res.error === "CredentialsSignin"
          ? "Invalid email or password."
          : res.error === "TooManyAttempts"
            ? "Too many failed attempts. Wait 15 minutes, or reset your password."
            : "Sign-in failed. Please try again.",
        { duration: 7000 }
      );
      return false;
    }
    // full navigation so the new session is picked up cleanly
    window.location.assign(callbackUrl);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      if (mode === "signup") {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password, acceptTerms }),
        });
        const data = await res.json();
        if (!data.success) {
          toast.error(data.error || "Could not create account.");
          return;
        }
        toast.success(data.emailSent === false ? "Account created." : `Account created — we sent a confirmation link to ${email}.`, { duration: 7000 });
      }
      const res = await signIn("credentials", { email, password, redirect: false });
      finish(res ?? undefined);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleProvider = async (provider: string) => {
    if (busy) return;
    setBusy(true);
    try {
      if (provider === "google") {
        await signIn("google", { callbackUrl });
        return;
      }
      const res = await signIn(provider, { redirect: false });
      finish(res ?? undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
        background: "var(--background)",
      }}
    >
      <div style={{ width: "100%", maxWidth: "400px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1.75rem", justifyContent: "center" }}>
          <BrandMark size={34} />
          <span style={{ fontSize: "1.3rem", fontWeight: 700, letterSpacing: "-0.03em" }}>Viralis</span>
        </div>

        <div className="panel-card" style={{ padding: "1.75rem" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.35rem" }}>
            {mode === "signin" ? "Sign in" : "Create your account"}
          </h1>
          <p className="text-muted" style={{ fontSize: "0.8125rem", marginBottom: "1.25rem" }}>
            {mode === "signin"
              ? "Welcome back."
              : "Free trial included — no card needed."}
          </p>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {mode === "signup" && (
              <div className="form-group">
                <label className="form-label" htmlFor="name">Name</label>
                <input
                  id="name"
                  className="input-field"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alex Rivera"
                  autoComplete="name"
                />
              </div>
            )}
            <div className="form-group">
              <label className="form-label" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                required
                className="input-field"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                autoComplete="email"
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                required
                minLength={mode === "signup" ? 10 : undefined}
                className="input-field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "signup" ? "At least 10 characters" : ""}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
              />
            </div>

            {mode === "signin" && (
              <a href="/auth/forgot" className="link" style={{ fontSize: "0.75rem", alignSelf: "flex-end" }}>Forgot password?</a>
            )}
            {mode === "signup" && (
              <label className="check-row" style={{ fontSize: "0.78rem" }}>
                <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} required />
                <span>I agree to the <a className="link" href="/terms" target="_blank">Terms</a> and <a className="link" href="/privacy" target="_blank">Privacy Policy</a>.</span>
              </label>
            )}
            <button type="submit" className="btn btn-primary" disabled={busy || (mode === "signup" && !acceptTerms)} style={{ width: "100%", marginTop: "0.25rem" }}>
              {busy ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
              {mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          {(googleLoginAvailable || devLoginAvailable) && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", margin: "1.15rem 0 0.9rem" }}>
              <div style={{ flex: 1, height: "1px", background: "var(--surface-border)" }} />
              <span className="text-subtle" style={{ fontSize: "0.6875rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>or</span>
              <div style={{ flex: 1, height: "1px", background: "var(--surface-border)" }} />
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {googleLoginAvailable && (
              <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => handleProvider("google")} style={{ width: "100%" }}>
                Continue with Google
              </button>
            )}
            {devLoginAvailable && (
              <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => handleProvider("dev")} style={{ width: "100%" }}>
                Developer sign-in (local only)
              </button>
            )}
          </div>

          {(signupOpen || mode === "signup") && (
          <p className="text-muted" style={{ fontSize: "0.8125rem", marginTop: "1.25rem", textAlign: "center" }}>
            {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
            <button
              type="button"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              style={{ background: "none", border: "none", color: "var(--foreground)", fontWeight: 600, cursor: "pointer", padding: 0 }}
            >
              {mode === "signin" ? "Sign up" : "Sign in"}
            </button>
          </p>
          )}
        </div>
      </div>
    </div>
  );
}
