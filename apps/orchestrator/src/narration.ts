/**
 * Phase 4.5 — narration channel between the Cursor agent and the avatar.
 *
 * Q3 (dead-air during codegen) is solved by giving Gemini Live "synthetic
 * assistant messages" sourced from the Cursor agent's own narration. The
 * orchestrator is the rate-limiter:
 *
 *   - Per session, at most ~2 sentences per minute.
 *   - At least 5 seconds between consecutive lines.
 *   - Skip empty / whitespace / single-token deltas (Cursor sometimes streams
 *     letter-by-letter; we want full sentences).
 *
 * The narration text is written into Convex (`sessions.narrationText`) via
 * `api.sessions.updateNarration`. The LiveKit agent runs a background task
 * that reads that field and, when it changes, calls `session.say(...)` to
 * make the avatar speak the line.
 *
 * If `CONVEX_URL` isn't configured we fall back to an HTTP POST against the
 * orchestrator's own `/api/avatar/narrate` (still useful in local dev).
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api.js";
import type { Id } from "../../../convex/_generated/dataModel.js";

type SessionId = Id<"sessions">;

/**
 * Per-session narration state. We accumulate deltas into a small buffer and
 * flush a sentence when we see end-punctuation OR when the buffer is older
 * than `maxBufferAgeMs`.
 */
interface NarrationState {
  buffer: string;
  bufferStartedAt: number;
  lastFlushAt: number;
  flushesInWindow: number; // last 60s
  windowStartedAt: number;
}

const MIN_INTERVAL_MS = 5_000; // at least 5s between lines
const MAX_LINES_PER_MIN = 2; // <2 sentences per minute
const MAX_BUFFER_AGE_MS = 8_000; // flush partial buffer if no period in 8s
const MIN_LINE_CHARS = 12; // anything shorter looks like noise
const MAX_LINE_CHARS = 240; // truncate long sentences

const _state = new Map<string, NarrationState>();

let _client: ConvexHttpClient | null = null;
function client(): ConvexHttpClient | null {
  if (_client) return _client;
  const url = process.env.CONVEX_URL;
  if (!url) return null;
  _client = new ConvexHttpClient(url);
  return _client;
}

function getState(sessionId: string): NarrationState {
  let s = _state.get(sessionId);
  if (!s) {
    s = {
      buffer: "",
      bufferStartedAt: 0,
      lastFlushAt: 0,
      flushesInWindow: 0,
      windowStartedAt: Date.now(),
    };
    _state.set(sessionId, s);
  }
  return s;
}

/**
 * Reset the state for a session — call when a new build starts so old
 * narration doesn't leak into the next session.
 */
export function resetNarration(sessionId: string): void {
  _state.delete(sessionId);
}

/**
 * Phase 4.5 entry point. Called from `cursor.ts` whenever an
 * `assistant_delta` arrives. Buffers fragments and flushes a single line
 * when we have a complete sentence or the buffer is stale, subject to the
 * rate limit.
 *
 * Best-effort: we never throw out of this function; narration is a UX
 * enhancement, not a critical-path mutation.
 */
export async function onAssistantDelta(
  sessionId: SessionId,
  text: string,
): Promise<void> {
  if (!text || !text.trim()) return;

  const s = getState(sessionId as string);
  const now = Date.now();

  // Roll the per-minute window.
  if (now - s.windowStartedAt > 60_000) {
    s.windowStartedAt = now;
    s.flushesInWindow = 0;
  }

  // Accumulate.
  if (s.buffer.length === 0) s.bufferStartedAt = now;
  s.buffer += text;

  // Try to flush a complete sentence.
  while (true) {
    const cut = findSentenceCut(s.buffer);
    const stale = s.buffer.length > 0 && now - s.bufferStartedAt > MAX_BUFFER_AGE_MS;
    if (cut === -1 && !stale) return; // nothing flushable

    let line: string;
    if (cut === -1) {
      // Stale buffer with no period — flush what we have.
      line = s.buffer.trim();
      s.buffer = "";
      s.bufferStartedAt = 0;
    } else {
      line = s.buffer.slice(0, cut + 1).trim();
      s.buffer = s.buffer.slice(cut + 1).trimStart();
      if (s.buffer.length > 0) s.bufferStartedAt = now;
      else s.bufferStartedAt = 0;
    }

    if (line.length < MIN_LINE_CHARS) continue;
    if (line.length > MAX_LINE_CHARS) line = line.slice(0, MAX_LINE_CHARS).trim() + "…";

    // Rate-limit gates.
    if (now - s.lastFlushAt < MIN_INTERVAL_MS) continue;
    if (s.flushesInWindow >= MAX_LINES_PER_MIN) continue;

    s.lastFlushAt = now;
    s.flushesInWindow += 1;

    await pushNarration(sessionId, line);
    // Only one flush per delta call.
    return;
  }
}

/**
 * Find the index of the last sentence-ending punctuation in `s` (period,
 * question mark, exclamation, ellipsis). Returns -1 if none.
 */
function findSentenceCut(s: string): number {
  for (let i = s.length - 1; i >= 0; i--) {
    const c = s[i];
    if (c === "." || c === "!" || c === "?") {
      // Avoid cutting on decimal numbers like "v1.2.3" — require following
      // whitespace OR end-of-buffer to make this a sentence cut.
      const next = s[i + 1];
      if (next === undefined || /\s/.test(next)) return i;
    }
  }
  return -1;
}

async function pushNarration(sessionId: SessionId, text: string): Promise<void> {
  // Two destinations, both best-effort:
  //   1. The LiveKit agent's /narrate endpoint — actually makes the avatar speak.
  //   2. Convex sessions.narrationText — the UI can surface a transcript line.
  await Promise.all([pushNarrationToAgent(sessionId, text), pushNarrationToConvex(sessionId, text)]);
}

async function pushNarrationToAgent(sessionId: SessionId, text: string): Promise<void> {
  const host = process.env.NARRATION_HOST ?? "127.0.0.1";
  const port = Number(process.env.NARRATION_PORT ?? 4100);
  try {
    await fetch(`http://${host}:${port}/narrate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId, text }),
      // Narration is fire-and-forget, but a stuck connection would block
      // codegen. AbortSignal.timeout (Node 18+) is the cleanest cap.
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    /* swallow — the LiveKit agent might be offline; codegen still runs */
  }
}

async function pushNarrationToConvex(sessionId: SessionId, text: string): Promise<void> {
  const c = client();
  if (!c) return;
  try {
    await c.mutation(api.sessions.updateNarration, {
      sessionId,
      narrationText: text,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[narration] convex mutation failed:", e);
  }
}
