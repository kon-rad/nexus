/**
 * Public read-side helpers for the signed-in user.
 *
 * `me()` returns the current user's profile (name + email + image) by
 * looking up `auth.getUserId(ctx)` against the `users` table that
 * `authTables` provisions. Returns null when unauthenticated so the
 * component can render an unauthenticated state instead of throwing.
 */

import { query } from "./_generated/server.js";
import { auth } from "./auth.js";

export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return null;
    return ctx.db.get(userId);
  },
});
