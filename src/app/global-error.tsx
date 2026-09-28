"use client";

// Replaces the root layout when it fails, so it can't rely on globals.css.
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0a", color: "#ededed", fontFamily: "system-ui, sans-serif" }}>
        <title>Something went wrong — Viralis</title>
        <div style={{ maxWidth: 420, padding: "2rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.125rem", marginBottom: "0.5rem" }}>Something went wrong</h1>
          <p style={{ fontSize: "0.875rem", color: "#a1a1aa", marginBottom: "1.25rem" }}>
            Viralis couldn&apos;t load.{error.digest ? ` (ref ${error.digest})` : ""}
          </p>
          <button
            type="button"
            onClick={() => unstable_retry()}
            style={{ padding: "0.6rem 1.25rem", borderRadius: 8, border: "none", background: "#ededed", color: "#0a0a0a", fontWeight: 600, cursor: "pointer" }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
