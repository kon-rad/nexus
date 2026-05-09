import { v } from "convex/values";
import { mutation, query } from "./_generated/server.js";

/**
 * Create a new session row. Called by the orchestrator when a new prompt arrives.
 * Returns the sessionId; the orchestrator stores this and uses it for all
 * downstream pushes.
 */
export const create = mutation({
  args: {
    userId: v.optional(v.string()),
  },
  handler: async (ctx, { userId }) => {
    const sessionId = await ctx.db.insert("sessions", {
      userId,
      createdAt: Date.now(),
      state: "INIT",
      statusMessage: "Session created",
    });
    return sessionId;
  },
});

/**
 * Update a session's high-level state (e.g. THINKING → CODING → RUNNING → PREVIEW).
 */
export const updateState = mutation({
  args: {
    sessionId: v.id("sessions"),
    state: v.string(),
    statusMessage: v.optional(v.string()),
    sandboxId: v.optional(v.string()),
    previewUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { sessionId, ...patch } = args;
    const filtered: Record<string, unknown> = {};
    for (const [k, v2] of Object.entries(patch)) {
      if (v2 !== undefined) filtered[k] = v2;
    }
    await ctx.db.patch(sessionId, filtered);
  },
});

export const get = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    return ctx.db.get(sessionId);
  },
});

/**
 * Phase 3: write the live avatar state ("listening" | "thinking" | "speaking" | "idle")
 * for the StatusBadge + glow. The LiveKit agent calls this through the orchestrator.
 */
export const updateAvatarState = mutation({
  args: {
    sessionId: v.id("sessions"),
    avatarState: v.string(),
    livekitRoom: v.optional(v.string()),
  },
  handler: async (ctx, { sessionId, avatarState, livekitRoom }) => {
    const patch: Record<string, unknown> = { avatarState };
    if (livekitRoom !== undefined) patch.livekitRoom = livekitRoom;
    await ctx.db.patch(sessionId, patch);
  },
});

/**
 * Phase 3: standalone session creation for voice-only flows. Used when the
 * workspace mounts before any prompt has been spoken — gives us a Convex row
 * to attach avatarState to. Phase 4 supersedes this with start_build → /api/session.
 */
export const ensureVoiceSession = mutation({
  args: { livekitRoom: v.optional(v.string()) },
  handler: async (ctx, { livekitRoom }) => {
    const sessionId = await ctx.db.insert("sessions", {
      createdAt: Date.now(),
      state: "INIT",
      statusMessage: "Voice session ready",
      avatarState: "idle",
      livekitRoom,
    });
    return sessionId;
  },
});

/**
 * Last 25 sessions, newest first. Useful for the profile page (Phase 4).
 */
export const list = query({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx, { userId }) => {
    let q = ctx.db.query("sessions").order("desc");
    const all = await q.take(25);
    if (userId === undefined) return all;
    return all.filter((s) => s.userId === userId);
  },
});
