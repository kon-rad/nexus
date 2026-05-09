import { v } from "convex/values";
import { mutation, query } from "./_generated/server.js";

/**
 * Append a single stdout/stderr line from a sandbox command. The orchestrator
 * batches these as `npm install`/`npm start` chunks arrive over Daytona's
 * session-command log stream.
 */
export const append = mutation({
  args: {
    sessionId: v.id("sessions"),
    stream: v.union(v.literal("stdout"), v.literal("stderr")),
    line: v.string(),
  },
  handler: async (ctx, { sessionId, stream, line }) => {
    await ctx.db.insert("logs", {
      sessionId,
      stream,
      line,
      ts: Date.now(),
    });
  },
});

/**
 * Append many lines at once — used when chunked stdout arrives so we don't
 * spam the mutation queue. Convex coalesces these into one reactive update.
 */
export const appendMany = mutation({
  args: {
    sessionId: v.id("sessions"),
    entries: v.array(
      v.object({
        stream: v.union(v.literal("stdout"), v.literal("stderr")),
        line: v.string(),
      }),
    ),
  },
  handler: async (ctx, { sessionId, entries }) => {
    const baseTs = Date.now();
    let i = 0;
    for (const e of entries) {
      // Stagger ts by 1ms each so chronological order survives the round-trip.
      await ctx.db.insert("logs", {
        sessionId,
        stream: e.stream,
        line: e.line,
        ts: baseTs + i++,
      });
    }
  },
});

/** All log lines for a session in chronological order. */
export const bySession = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    return ctx.db
      .query("logs")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .order("asc")
      .take(2000);
  },
});
