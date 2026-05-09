/**
 * Convex Auth wiring — Google sign-in for the workspace nav.
 *
 * `convexAuth({ providers })` returns the standard set of helpers:
 *   - `auth`         — the auth handle (`auth.getUserId(ctx)` etc.)
 *   - `signIn`       — public action: web client calls via `useAuthActions`
 *   - `signOut`      — public action
 *   - `store`        — internal mutation Convex Auth uses to persist state
 *   - `isAuthenticated` — public query the middleware reads
 *
 * The actual HTTP routes (`/api/auth/signin/google`, OAuth callback,
 * JWKS) are mounted by `auth.addHttpRoutes(http)` in `convex/http.ts`.
 *
 * Env required on the Convex deployment (see `docs/auth-setup.md`):
 *   AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, JWT_PRIVATE_KEY, JWKS, SITE_URL
 */

import Google from "@auth/core/providers/google";
import { convexAuth } from "@convex-dev/auth/server";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Google],
});
