/**
 * Nexus orchestrator entry point.
 *
 *   POST /api/session         { prompt, sessionId? } → { sessionId }
 *
 * The body's optional `sessionId` opts into multi-turn: we resume the
 * Cursor agent and reuse the Daytona sandbox attached to that session
 * instead of spinning up new ones (Q4 — multi-turn sandbox state).
 *
 * Streaming happens out-of-band via Convex. The frontend never polls or
 * RPCs us for agent state — it subscribes to the Convex tables the
 * pusher writes to.
 */

import * as path from "node:path";
import "dotenv/config";
import Fastify from "fastify";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api.js";
import type { Id } from "../../../convex/_generated/dataModel.js";
import {
  createSession,
  updateSandbox,
  updateSessionState,
  type SessionId,
} from "./convex-pusher.js";
import { getOrCreateSandbox } from "./daytona.js";
import { runAgent } from "./cursor.js";
import { registerLiveKitRoutes } from "./livekit.js";

export const ORCHESTRATOR_VERSION = "0.2.0";

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
}));

// Phase 3: LiveKit token mint + avatar-state mirror.
registerLiveKitRoutes(fastify);

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
    //    immediately so the dev prompt bar doesn't block the UI for 30s.
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
  });

  if (result.agentId) {
    agentBySession.set(sessionId, result.agentId);
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
