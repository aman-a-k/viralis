"use client";

import { useEffect } from "react";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem", background: "var(--background)" }}>
      <div className="panel-card" role="alert" style={{ maxWidth: 420, textAlign: "center", padding: "2rem" }}>
        <h1 style={{ fontSize: "1.125rem", fontWeight: 700, marginBottom: "0.5rem" }}>Something went wrong</h1>
        <p className="text-muted" style={{ fontSize: "0.8125rem", marginBottom: "1.25rem" }}>
          Viralis hit an unexpected error loading this page.
          {error.digest ? ` (ref ${error.digest})` : ""}
        </p>
        <button type="button" className="btn btn-primary" onClick={() => unstable_retry()}>
          Try again
        </button>
      </div>
    </div>
  );
}
