"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

/**
 * Singleton Convex client. Created once per browser session. The reactive
 * websocket is established lazily on first useQuery.
 *
 * If NEXT_PUBLIC_CONVEX_URL is unset (e.g. someone forgot to copy
 * .env.example), we render children without a provider — useQuery will
 * throw at the call site with a clear message instead of crashing the
 * whole tree at module load.
 *
 * Phase 2: anonymous-only. Auth is post-hackathon.
 */
const convex: ConvexReactClient | null = convexUrl
  ? new ConvexReactClient(convexUrl)
  : null;

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  if (!convex) {
    return <>{children}</>;
  }
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
