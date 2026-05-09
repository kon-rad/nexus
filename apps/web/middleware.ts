/**
 * Convex Auth Next.js middleware.
 *
 * Keeps the auth cookie in sync across server-component renders so
 * `<Authenticated>` / `<Unauthenticated>` and `useAuthActions()` reflect the
 * real session state, even on first paint.
 *
 * No route protection here yet — the workspace stays publicly browseable
 * for the demo. Add a `nextjsMiddlewareRedirect()` block if we ever want to
 * gate routes behind auth.
 */

import { convexAuthNextjsMiddleware } from "@convex-dev/auth/nextjs/server";

export default convexAuthNextjsMiddleware();

export const config = {
  // Skip Next.js internals + static assets so the middleware only runs on
  // real page/data requests.
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
