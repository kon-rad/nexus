import { v } from "convex/values";
import { mutation, query } from "./_generated/server.js";

/**
 * Upsert the sandbox row for a session. The orchestrator calls this twice:
 *  - once with `status: "creating"` right after `daytona.create()`
 *  - once with `status: "preview-ready"` and a real `previewUrl` after the
 *    generated app starts listening on its port.
 */
export const update = mutation({
  args: {
    sessionId: v.id("sessions"),
    daytonaId: v.string(),
    mcpUrl: v.optional(v.string()),
    mcpToken: v.optional(v.string()),
    previewUrl: v.optional(v.string()),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("sandbox")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .first();
    if (existing) {
      const patch: Record<string, unknown> = {};
      for (const [k, v2] of Object.entries(args)) {
        if (k === "sessionId") continue;
        if (v2 !== undefined) patch[k] = v2;
      }
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }
    return ctx.db.insert("sandbox", {
      sessionId: args.sessionId,
      daytonaId: args.daytonaId,
      mcpUrl: args.mcpUrl,
      mcpToken: args.mcpToken,
      previewUrl: args.previewUrl,
      status: args.status,
    });
  },
});

/** Read the sandbox row for a session. The Live Preview iframe reads previewUrl. */
export const bySession = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    return ctx.db
      .query("sandbox")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .first();
  },
});
