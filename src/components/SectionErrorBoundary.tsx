"use client";

import { unstable_catchError, type ErrorInfo } from "next/error";
import { AlertTriangle, RefreshCw } from "lucide-react";

function SectionErrorFallback({ section }: { section: string }, { error, reset }: ErrorInfo) {
  console.error(`[${section}] render error:`, error);
  return (
    <div className="panel-card" role="alert" style={{ textAlign: "center", padding: "2.5rem 1.5rem" }}>
      <AlertTriangle size={20} color="#f59e0b" style={{ margin: "0 auto 0.75rem" }} />
      <p style={{ fontSize: "0.9375rem", fontWeight: 600, marginBottom: "0.35rem" }}>
        {section} hit an unexpected error
      </p>
      <p className="text-muted" style={{ fontSize: "0.8125rem", marginBottom: "1rem" }}>
        The rest of the app still works. Try reloading this section.
      </p>
      <button type="button" className="btn btn-secondary" style={{ fontSize: "0.75rem" }} onClick={() => reset()}>
        <RefreshCw size={13} /> Reload section
      </button>
    </div>
  );
}

// Wraps one dashboard tab so a crash inside it doesn't blank the whole app.
export const SectionErrorBoundary = unstable_catchError(SectionErrorFallback);
