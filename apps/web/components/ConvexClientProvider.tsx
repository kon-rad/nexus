"use client";

import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { ConvexReactClient } from "convex/react";
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
 * Wraps with `ConvexAuthNextjsProvider` so `useAuthActions()` and
 * `<Authenticated>` / `<Unauthenticated>` work in client components. The
 * server-side counterpart `ConvexAuthNextjsServerProvider` is set up in
 * `app/layout.tsx`, and the middleware in `middleware.ts` keeps the auth
 * cookie in sync across server-component renders.
 */
const convex: ConvexReactClient | null = convexUrl
  ? new ConvexReactClient(convexUrl)
  : null;

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  if (!convex) {
    return <>{children}</>;
  }
  return (
    <ConvexAuthNextjsProvider client={convex}>
      {children}
    </ConvexAuthNextjsProvider>
  );
}
