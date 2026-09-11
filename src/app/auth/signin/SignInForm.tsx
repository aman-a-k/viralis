"use client";

import React, { useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { Zap, ArrowRight, Loader2 } from "lucide-react";

interface Props {
  devLoginAvailable: boolean;
  googleLoginAvailable: boolean;
}

export function SignInForm({ devLoginAvailable, googleLoginAvailable }: Props) {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const finish = (res: { error?: string | null; ok?: boolean } | undefined) => {
    if (res?.error) {
      toast.error(res.error === "CredentialsSignin" ? "Invalid email or password." : res.error);
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
          body: JSON.stringify({ name, email, password }),
        });
        const data = await res.json();
        if (!data.success) {
          toast.error(data.error || "Could not create account.");
          return;
        }
        toast.success("Account created.");
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
          <div
            style={{
              width: "34px",
              height: "34px",
              borderRadius: "10px",
              background: "var(--gradient-brand)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 18px -2px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,0.25)",
            }}
          >
            <Zap size={18} color="#fff" fill="#fff" />
          </div>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "1.3rem", fontWeight: 700, letterSpacing: "-0.03em" }}>Viralis</span>
        </div>

        <div className="panel-card" style={{ padding: "1.75rem" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.35rem" }}>
            {mode === "signin" ? "Sign in" : "Create your account"}
          </h1>
          <p className="text-muted" style={{ fontSize: "0.8125rem", marginBottom: "1.25rem" }}>
            {mode === "signin"
              ? "Access your repurposing studio and distribution pipeline."
              : "Start turning long-form video into multi-platform shorts."}
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
                minLength={8}
                className="input-field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={busy} style={{ width: "100%", marginTop: "0.25rem" }}>
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
                Developer bypass (skip login)
              </button>
            )}
          </div>

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
        </div>
      </div>
    </div>
  );
}
