/**
 * Nexus orchestrator entry point.
 *
 *   POST /api/session         { prompt, sessionId? } → { sessionId }
 *
 * The body's optional `sessionId` opts into multi-turn: we resume the
 * Cursor agent and reuse the Daytona sandbox attached to that session
 * instead of spinning up new ones (Q4 — multi-turn sandbox state).
 *
 * Phase 4 wires `POST /api/avatar/tool-call` so the LiveKit agent's
 * Gemini Live tool calls (start_build / modify_build / stop_build) route
 * into this same workflow without the user typing anything.
 *
 * Streaming happens out-of-band via Convex. The frontend never polls or
 * RPCs us for agent state — it subscribes to the Convex tables the
 * pusher writes to.
 */

import * as path from "node:path";
import "dotenv/config";
import Fastify from "fastify";
import { ConvexHttpClient } from "convex/browser";
import type { Run } from "@cursor/sdk";
import { api } from "../../../convex/_generated/api.js";
import type { Id } from "../../../convex/_generated/dataModel.js";
import {
  createSession,
  updateSandbox,
  updateSessionState,
  type SessionId,
} from "./convex-pusher.js";
import { getOrCreateSandbox, deleteSandbox } from "./daytona.js";
import { runAgent } from "./cursor.js";
import { registerLiveKitRoutes, setOrchestratorHooks } from "./livekit.js";
import { resetNarration } from "./narration.js";

export const ORCHESTRATOR_VERSION = "0.4.0";

const PORT = Number(process.env.PORT ?? 4000);
const WORKDIR = process.env.ORCHESTRATOR_WORKDIR ?? "/tmp/nexus-orchestrator";

/**
 * Per-session in-process state. Keys are session ids; values are the most
 * recent Cursor agent id we got back from `Agent.create()`. We use this for
 * Agent.resume() on follow-up prompts — same conversation, same context.
 *
 * This is a hackathon-grade store (lost on restart). Phase 5 swaps in a
 * persistent layer or stops relying on agent ids and uses Cursor's
 * server-side conversation persistence.
 */
const agentBySession = new Map<string, string>();

/**
 * In-flight Run handles per session. Used by Phase 4.6 cancel routing —
 * `runHandle.cancel()` aborts the Cursor agent's current send() loop.
 */
const runBySession = new Map<string, Run>();

const fastify = Fastify({
  logger: {
    level: "info",
    transport: { target: "pino-pretty", options: { colorize: true } },
  },
});

// CORS for the Next.js dev server. Tight: only the orchestrator URL the web
// app advertises is allowed.
fastify.addHook("onRequest", async (req, reply) => {
  reply.header("Access-Control-Allow-Origin", "*");
  reply.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  reply.header("Access-Control-Allow-Headers", "content-type");
  if (req.method === "OPTIONS") {
    reply.code(204).send();
  }
});

fastify.get("/api/health", async () => ({
  ok: true,
  version: ORCHESTRATOR_VERSION,
  cursorKey: !!process.env.CURSOR_API_KEY,
  daytonaKey: !!process.env.DAYTONA_API_KEY,
  convexUrl: !!process.env.CONVEX_URL,
  livekitConfigured: !!process.env.LIVEKIT_API_KEY && !!process.env.LIVEKIT_API_SECRET,
  geminiConfigured: !!process.env.GOOGLE_API_KEY || !!process.env.GEMINI_API_KEY,
  tavusConfigured: !!process.env.TAVUS_API_KEY,
  agentDispatchConfigured:
    !!process.env.LIVEKIT_AGENT_NAME &&
    !!process.env.LIVEKIT_API_KEY &&
    !!process.env.LIVEKIT_API_SECRET,
}));

// Phase 3+: LiveKit token mint + avatar-state mirror + Phase 4 tool-call routing.
registerLiveKitRoutes(fastify);

// Wire the tool-call hooks AFTER routes are registered so livekit.ts can call
// back into us without a circular import.
setOrchestratorHooks({
  startBuild: async ({ sessionId, intent }) => {
    const followup = await resolveExistingSession(sessionId);
    const resolvedId: SessionId =
      followup?.sessionId ?? (await createSession());
    void runSessionWorkflow({
      prompt: intent,
      sessionId: resolvedId,
      followup,
    }).catch(async (err) => {
      // eslint-disable-next-line no-console
      console.error("[start_build] workflow failed:", err);
      try {
        await updateSessionState(resolvedId, "ERROR", {
          statusMessage: `Orchestrator error: ${(err as Error).message}`,
        });
      } catch {
        /* convex may also be down — give up */
      }
    });
    return { sessionId: resolvedId };
  },
  modifyBuild: async ({ sessionId, change }) => {
    const followup = await resolveExistingSession(sessionId);
    if (!followup) {
      // Convex doesn't know this session id — treat as a fresh build to
      // recover gracefully. The voice agent will sound the same to the user.
      const fresh: SessionId = await createSession();
      void runSessionWorkflow({
        prompt: change,
        sessionId: fresh,
        followup: undefined,
      }).catch((err) => {
        // eslint-disable-next-line no-console
        console.error("[modify_build → start_build] failed:", err);
      });
      return { sessionId: fresh };
    }
    void runSessionWorkflow({
      prompt: change,
      sessionId: followup.sessionId,
      followup,
    }).catch(async (err) => {
      // eslint-disable-next-line no-console
      console.error("[modify_build] workflow failed:", err);
      try {
        await updateSessionState(followup.sessionId, "ERROR", {
          statusMessage: `Orchestrator error: ${(err as Error).message}`,
        });
      } catch {
        /* convex may also be down — give up */
      }
    });
    return { sessionId: followup.sessionId };
  },
  cancelBuild: async ({ sessionId, reason }) => {
    const handle = runBySession.get(sessionId);
    if (handle) {
      try {
        await handle.cancel();
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("[cancel] run.cancel() raised:", e);
      }
      runBySession.delete(sessionId);
    }
    // Best-effort: mark Convex so the UI can render the failure-mode banner.
    if (process.env.CONVEX_URL) {
      try {
        const c = new ConvexHttpClient(process.env.CONVEX_URL);
        await c.mutation(api.sessions.endSession, {
          sessionId: sessionId as SessionId,
          endReason: reason,
          state: "DONE",
        });
      } catch {
        /* swallow */
      }
    }
    resetNarration(sessionId);
    return { ok: true };
  },
});

interface SessionRequestBody {
  prompt: string;
  sessionId?: string;
}

fastify.post<{ Body: SessionRequestBody }>(
  "/api/session",
  async (req, reply) => {
    const body = req.body ?? ({} as SessionRequestBody);
    if (typeof body.prompt !== "string" || body.prompt.trim().length === 0) {
      return reply.code(400).send({ error: "prompt is required" });
    }

    // 1. Resolve session: new (no id) or follow-up (id present + valid).
    const followup = await resolveExistingSession(body.sessionId);
    const sessionId: SessionId =
      followup?.sessionId ?? (await createSession());

    // 2. Kick the heavy work into the background. The HTTP response returns
    //    immediately so the caller doesn't block for 30s.
    void runSessionWorkflow({
      prompt: body.prompt,
      sessionId,
      followup,
    }).catch(async (err) => {
      // eslint-disable-next-line no-console
      console.error("[session] workflow failed:", err);
      try {
        await updateSessionState(sessionId, "ERROR", {
          statusMessage: `Orchestrator error: ${(err as Error).message}`,
        });
      } catch {
        /* convex may also be down — give up */
      }
    });

    return reply.code(202).send({ sessionId });
  },
);

/**
 * Phase 4.9 — export the current sandbox as a ZIP. The frontend's "Export
 * Code" button calls this; the response streams the ZIP back to the
 * browser. Implementation: use Daytona's filesystem API to walk the
 * workspace and stream entries into a zip stream. If the SDK exposes a
 * native download helper, prefer that. Falls back to `daytonaId` lookup
 * via Convex.
 *
 * For the hackathon we keep this simple: the orchestrator-side per-session
 * scratch dir on disk (`WORKDIR/<sessionId>`) already mirrors every file
 * the Cursor agent writes. We zip that. (The Daytona side has the running
 * dev server; the user wants the source.)
 */
fastify.get("/api/session/:sessionId/export", async (req, reply) => {
  const sessionId = (req.params as { sessionId: string }).sessionId;
  if (!sessionId) {
    return reply.code(400).send({ error: "sessionId is required" });
  }
  const cwd = path.join(WORKDIR, sessionId);
  // Lazy-import to keep the cold start tight — JSZip is small but unused
  // until export.
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const { promises: fs } = await import("node:fs");
  async function walk(dir: string, prefix: string): Promise<void> {
    let entries: import("node:fs").Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const abs = path.join(dir, e.name);
      const rel = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (e.name === "node_modules" || e.name === ".git" || e.name === "dist") {
          continue;
        }
        await walk(abs, rel);
      } else if (e.isFile()) {
        try {
          const buf = await fs.readFile(abs);
          if (buf.length < 5_000_000) zip.file(rel, buf);
        } catch {
          /* skip unreadable */
        }
      }
    }
  }
  try {
    await walk(cwd, "");
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[export] walk failed:", e);
  }
  // If the workdir was empty, surface a 404 so the UI shows a real error.
  const fileCount = Object.keys(zip.files).length;
  if (fileCount === 0) {
    return reply.code(404).send({ error: "no files in session workspace" });
  }
  const buf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  return reply
    .code(200)
    .header("content-type", "application/zip")
    .header(
      "content-disposition",
      `attachment; filename="nexus-${sessionId}.zip"`,
    )
    .send(buf);
});

interface FollowupContext {
  sessionId: SessionId;
  agentId: string | undefined;
  daytonaId: string | undefined;
}

async function resolveExistingSession(
  raw: string | undefined,
): Promise<FollowupContext | undefined> {
  if (!raw) return undefined;
  const url = process.env.CONVEX_URL;
  if (!url) return undefined;
  const client = new ConvexHttpClient(url);
  let session;
  try {
    session = await client.query(api.sessions.get, {
      sessionId: raw as Id<"sessions">,
    });
  } catch {
    return undefined;
  }
  if (!session) return undefined;
  let daytonaId: string | undefined;
  try {
    const sandbox = await client.query(api.sandbox.bySession, {
      sessionId: raw as Id<"sessions">,
    });
    daytonaId = sandbox?.daytonaId;
  } catch {
    /* missing sandbox row — we'll create one */
  }
  return {
    sessionId: raw as Id<"sessions">,
    agentId: agentBySession.get(raw),
    daytonaId,
  };
}

async function runSessionWorkflow(opts: {
  prompt: string;
  sessionId: SessionId;
  followup: FollowupContext | undefined;
}): Promise<void> {
  const { prompt, sessionId, followup } = opts;

  // Reset narration state at the start of every turn so old buffer fragments
  // don't leak into the new run.
  resetNarration(sessionId);

  await updateSessionState(sessionId, "INIT", {
    statusMessage: followup?.daytonaId
      ? "Resuming sandbox…"
      : "Spinning up sandbox…",
  });

  const sandbox = await getOrCreateSandbox(sessionId, followup?.daytonaId);

  await updateSandbox(sessionId, {
    daytonaId: sandbox.sandboxId,
    status: followup?.daytonaId ? "ready" : "creating",
  });

  const cwd = path.join(WORKDIR, sessionId);

  const result = await runAgent({
    prompt,
    sandbox,
    sessionId,
    existingAgentId: followup?.agentId,
    cwd,
    onRunHandle: (run) => {
      runBySession.set(sessionId, run);
    },
  });

  // Run is finished one way or another — drop the cancel handle.
  runBySession.delete(sessionId);

  if (result.agentId) {
    agentBySession.set(sessionId, result.agentId);
  }

  if (result.cancelled) {
    // On hard cancel the user explicitly asked to abort. Tear down the
    // sandbox to avoid orphans and prevent the next start_build from
    // accidentally reusing its files.
    try {
      await deleteSandbox(sandbox.sandboxId);
    } catch {
      /* swallow */
    }
    agentBySession.delete(sessionId);
  }
}

const start = async (): Promise<void> => {
  try {
    await fastify.listen({ port: PORT, host: "0.0.0.0" });
    fastify.log.info(`Nexus orchestrator ${ORCHESTRATOR_VERSION} on :${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

if (import.meta.url === `file://${process.argv[1]}`) {
  void start();
}
