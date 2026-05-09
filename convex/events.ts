import { v } from "convex/values";
import { mutation, query } from "./_generated/server.js";

/**
 * Push a single event from the Cursor agent stream into Convex.
 * `payload` is intentionally `v.any()` because the Cursor SDK tool-call
 * shape is documented as unstable; the orchestrator parses defensively
 * and the frontend treats unknown event types as no-op.
 */
export const push = mutation({
  args: {
    sessionId: v.id("sessions"),
    type: v.string(),
    payload: v.any(),
  },
  handler: async (ctx, { sessionId, type, payload }) => {
    await ctx.db.insert("events", {
      sessionId,
      type,
      payload,
      ts: Date.now(),
    });
  },
});

/**
 * All events for a session in chronological order.
 * The Insights tab uses this to find the latest assistant_delta.
 */
export const bySession = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    return ctx.db
      .query("events")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .order("asc")
      .take(500);
  },
});
