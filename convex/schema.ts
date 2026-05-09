/**
 * Nexus Convex schema — Phase 2.
 *
 * The orchestrator pushes here; the frontend subscribes via useQuery.
 * The State table in `docs/coding-agent-architecture.md` §3 is the source of truth.
 */

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  /** One row per user prompt session. Created when POST /api/session lands. */
  sessions: defineTable({
    userId: v.optional(v.string()),
    createdAt: v.number(),
    sandboxId: v.optional(v.string()),
    previewUrl: v.optional(v.string()),
    /** Coarse lifecycle: "INIT" | "THINKING" | "CODING" | "RUNNING" | "PREVIEW" | "ERROR" | "DONE". */
    state: v.string(),
    /** Latest free-text status line for the UI ("Spinning up sandbox…", etc). */
    statusMessage: v.optional(v.string()),
    /**
     * Phase 3: voice/avatar state, written by the LiveKit agent through the
     * orchestrator. "idle" | "listening" | "thinking" | "speaking".
     * Drives the StatusBadge and the avatar glow color in the workspace.
     */
    avatarState: v.optional(v.string()),
    /** LiveKit room name this session lives in. */
    livekitRoom: v.optional(v.string()),
  }),

  /**
   * Append-only event stream from the Cursor agent: assistant_delta, tool_call,
   * tool_result, status. The UI tails this for the Insights explanation half
   * (latest assistant_delta) and any terminal-style narration.
   */
  events: defineTable({
    sessionId: v.id("sessions"),
    /** "THINKING" | "CODING" | "RUNNING" | "PREVIEW" | "CHAT" | "ERROR". */
    type: v.string(),
    payload: v.any(),
    ts: v.number(),
  }).index("by_session", ["sessionId", "ts"]),

  /** Latest snapshot of every file the agent has written this session. */
  files: defineTable({
    sessionId: v.id("sessions"),
    path: v.string(),
    content: v.string(),
    lastWrittenAt: v.number(),
  })
    .index("by_session", ["sessionId", "lastWrittenAt"])
    .index("by_session_path", ["sessionId", "path"]),

  /** Append-only stdout/stderr lines from sandbox commands. xterm.js streams these. */
  logs: defineTable({
    sessionId: v.id("sessions"),
    stream: v.union(v.literal("stdout"), v.literal("stderr")),
    line: v.string(),
    ts: v.number(),
  }).index("by_session", ["sessionId", "ts"]),

  /**
   * Per-call record of a fal.ai model invocation. The orchestrator inserts a
   * row when the agent calls run_fal_model, then patches it as the queue
   * progresses (queued → in_progress → completed/error). The Generate tab
   * subscribes to this table to render typed previews.
   */
  falJobs: defineTable({
    sessionId: v.id("sessions"),
    requestId: v.optional(v.string()),
    endpointId: v.string(),
    displayName: v.optional(v.string()),
    category: v.optional(v.string()),
    input: v.any(),
    status: v.string(),
    queuePosition: v.optional(v.number()),
    output: v.optional(v.any()),
    outputKind: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_session", ["sessionId", "createdAt"])
    .index("by_request", ["requestId"]),

  /** Daytona sandbox state for the Live Preview iframe URL bar. */
  sandbox: defineTable({
    sessionId: v.id("sessions"),
    daytonaId: v.string(),
    mcpUrl: v.optional(v.string()),
    mcpToken: v.optional(v.string()),
    previewUrl: v.optional(v.string()),
    /** "creating" | "ready" | "starting-app" | "preview-ready" | "stopped" | "error". */
    status: v.string(),
  }).index("by_session", ["sessionId"]),
});
