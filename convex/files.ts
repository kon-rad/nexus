import { v } from "convex/values";
import { mutation, query } from "./_generated/server.js";

/**
 * Upsert latest content for `path` in this session. Cursor agent file writes
 * land here. The Code Inspection tab renders the most-recently-written file.
 */
export const upsert = mutation({
  args: {
    sessionId: v.id("sessions"),
    path: v.string(),
    content: v.string(),
  },
  handler: async (ctx, { sessionId, path, content }) => {
    const existing = await ctx.db
      .query("files")
      .withIndex("by_session_path", (q) =>
        q.eq("sessionId", sessionId).eq("path", path),
      )
      .first();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { content, lastWrittenAt: now });
      return existing._id;
    }
    return ctx.db.insert("files", {
      sessionId,
      path,
      content,
      lastWrittenAt: now,
    });
  },
});

/** All files in a session, ordered by most-recently-written first. */
export const bySession = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    const all = await ctx.db
      .query("files")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .collect();
    return all.sort((a, b) => b.lastWrittenAt - a.lastWrittenAt);
  },
});
