"use client";

import { SessionProvider } from "next-auth/react";
import { SpotlightLayer } from "./motion";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SpotlightLayer />
      {children}
    </SessionProvider>
  );
}
