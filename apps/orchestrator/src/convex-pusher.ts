/**
 * Thin wrapper around `ConvexHttpClient` that maps Cursor SDK event types
 * (`assistant_delta`, `tool_call`, `tool_result`, `status`) to Convex
 * mutations on the schema defined in `convex/schema.ts`.
 *
 * Lives entirely on the orchestrator side. The browser never talks to this
 * file — it talks to Convex directly via reactive `useQuery`.
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api.js";
import type { Id } from "../../../convex/_generated/dataModel.js";

let _client: ConvexHttpClient | null = null;

function getClient(): ConvexHttpClient {
  if (_client) return _client;
  const url = process.env.CONVEX_URL;
  if (!url) {
    throw new Error("CONVEX_URL is not set. Add it to apps/orchestrator/.env.");
  }
  _client = new ConvexHttpClient(url);
  return _client;
}

export type SessionId = Id<"sessions">;

/**
 * Coarse session lifecycle states. The frontend reads this to drive overall
 * UI mode; finer-grained progress flows through the `events` table.
 */
export type SessionState =
  | "INIT"
  | "THINKING"
  | "CODING"
  | "RUNNING"
  | "PREVIEW"
  | "ERROR"
  | "DONE";

export async function createSession(userId?: string): Promise<SessionId> {
  return getClient().mutation(api.sessions.create, { userId });
}

export async function updateSessionState(
  sessionId: SessionId,
  state: SessionState,
  opts: {
    statusMessage?: string;
    sandboxId?: string;
    previewUrl?: string;
  } = {},
): Promise<void> {
  await getClient().mutation(api.sessions.updateState, {
    sessionId,
    state,
    statusMessage: opts.statusMessage,
    sandboxId: opts.sandboxId,
    previewUrl: opts.previewUrl,
  });
}

export async function pushEvent(
  sessionId: SessionId,
  type: string,
  payload: unknown,
): Promise<void> {
  await getClient().mutation(api.events.push, {
    sessionId,
    type,
    payload,
  });
}

export async function upsertFile(
  sessionId: SessionId,
  path: string,
  content: string,
): Promise<void> {
  await getClient().mutation(api.files.upsert, {
    sessionId,
    path,
    content,
  });
}

export async function appendLog(
  sessionId: SessionId,
  stream: "stdout" | "stderr",
  line: string,
): Promise<void> {
  await getClient().mutation(api.logs.append, {
    sessionId,
    stream,
    line,
  });
}

export async function appendLogs(
  sessionId: SessionId,
  entries: ReadonlyArray<{ stream: "stdout" | "stderr"; line: string }>,
): Promise<void> {
  if (entries.length === 0) return;
  await getClient().mutation(api.logs.appendMany, {
    sessionId,
    entries: [...entries],
  });
}

export async function updateSandbox(
  sessionId: SessionId,
  args: {
    daytonaId: string;
    mcpUrl?: string;
    mcpToken?: string;
    previewUrl?: string;
    status: string;
  },
): Promise<void> {
  await getClient().mutation(api.sandbox.update, {
    sessionId,
    ...args,
  });
}
