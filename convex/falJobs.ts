import { v } from "convex/values";
import { mutation, query } from "./_generated/server.js";

/**
 * Insert a queued fal job row. Returns the new doc id; the orchestrator stores
 * this and uses it for all downstream patches.
 */
export const enqueue = mutation({
  args: {
    sessionId: v.id("sessions"),
    endpointId: v.string(),
    displayName: v.optional(v.string()),
    category: v.optional(v.string()),
    input: v.any(),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("falJobs", {
      ...args,
      status: "queued",
      createdAt: Date.now(),
    });
  },
});

/** Patch queue state mid-run. Called on every status transition from fal. */
export const updateStatus = mutation({
  args: {
    jobId: v.id("falJobs"),
    status: v.string(),
    requestId: v.optional(v.string()),
    queuePosition: v.optional(v.number()),
  },
  handler: async (ctx, { jobId, ...patch }) => {
    const filtered: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(patch)) {
      if (val !== undefined) filtered[k] = val;
    }
    await ctx.db.patch(jobId, filtered);
  },
});

/** Mark a job completed and stamp the output + detected kind. */
export const setOutput = mutation({
  args: {
    jobId: v.id("falJobs"),
    output: v.any(),
    outputKind: v.string(),
  },
  handler: async (ctx, { jobId, output, outputKind }) => {
    await ctx.db.patch(jobId, {
      status: "completed",
      output,
      outputKind,
      completedAt: Date.now(),
    });
  },
});

/** Mark a job failed. */
export const setError = mutation({
  args: {
    jobId: v.id("falJobs"),
    errorMessage: v.string(),
  },
  handler: async (ctx, { jobId, errorMessage }) => {
    await ctx.db.patch(jobId, {
      status: "error",
      errorMessage,
      completedAt: Date.now(),
    });
  },
});

/** All fal jobs for a session, oldest first (so the UI scrolls top-to-bottom). */
export const bySession = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    return ctx.db
      .query("falJobs")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .order("asc")
      .take(50);
  },
});

export const get = query({
  args: { jobId: v.id("falJobs") },
  handler: async (ctx, { jobId }) => ctx.db.get(jobId),
});
