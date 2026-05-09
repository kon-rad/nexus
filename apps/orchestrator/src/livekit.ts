/**
 * LiveKit token mint, agent dispatch, avatar state, tool-call routing.
 *
 * Endpoints:
 *
 *   POST /api/livekit/token       { sessionId? } → { token, url, room, identity, sessionId, agentName }
 *     Mints a 10-min JWT for the browser. Grants room subscribe + mic publish.
 *     Phase 4: AFTER the token is minted, we use AgentDispatchClient (Twirp)
 *     to dispatch the worker to the room. JWT-side dispatch is gone — this
 *     fixes the v1.11 server / 2.15 SDK proto incompat the Phase 3 hotfix
 *     papered over with empty agent_name + auto-join.
 *
 *   POST /api/avatar/state        { sessionId, avatarState, livekitRoom? }
 *     Mirrors agent_state_changed events to Convex sessions.avatarState.
 *
 *   POST /api/avatar/tool-call    { sessionId, name, args }
 *     Phase 4 dispatch. start_build → kicks a fresh codegen run on the same
 *     session row (POST /api/session under the hood, which creates a Convex
 *     row when sessionId is missing/voice-only). modify_build → reuses the
 *     existing session, resumes the Cursor agent + Daytona sandbox.
 *     stop_build → cancels the active Cursor Run for the session.
 *
 *   POST /api/avatar/narrate      { sessionId, text }
 *     Phase 4.5 narration channel. The orchestrator pushes Cursor
 *     assistant_delta fragments here (rate-limited); the LiveKit agent
 *     polls Convex via the same row to read narration. Or, if a direct HTTP
 *     hook to the agent is available, we POST to it. Either way, the avatar
 *     speaks aloud what the agent is "thinking" so dead-air is bounded
 *     (Q3).
 *
 * Secrets stay here. The browser only ever sees the JWT, scoped to one room.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { AccessToken, AgentDispatchClient } from "livekit-server-sdk";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api.js";
import type { Id } from "../../../convex/_generated/dataModel.js";

type SessionId = Id<"sessions">;

interface TokenRequestBody {
  sessionId?: string;
  /** Optional human label for the participant (defaults to "user-<rand>"). */
  identity?: string;
}

interface TokenResponseBody {
  token: string;
  url: string;
  room: string;
  identity: string;
  sessionId: SessionId;
  agentName: string;
  agentDispatched: boolean;
}

interface AvatarStateBody {
  sessionId: string;
  avatarState: string;
  livekitRoom?: string;
}

interface ToolCallBody {
  sessionId: string;
  name: string;
  args?: Record<string, unknown>;
}

interface NarrateBody {
  sessionId: string;
  text: string;
}

interface ToolCallResponse {
  ok: boolean;
  sessionId: string;
  name: string;
  status: "started" | "queued" | "cancelled" | "ignored";
  reason?: string;
}

/**
 * Hook the orchestrator's session dispatcher injects so this module can call
 * back into the in-process session map without a circular import. Set by
 * `index.ts` at boot via `setOrchestratorHooks`.
 */
export interface OrchestratorHooks {
  /** Kick a fresh codegen run. Returns the resolved sessionId. */
  startBuild(args: {
    sessionId: string | undefined;
    intent: string;
  }): Promise<{ sessionId: SessionId }>;
  /** Modify an existing build via Agent.resume. */
  modifyBuild(args: {
    sessionId: string;
    change: string;
  }): Promise<{ sessionId: SessionId }>;
  /** Cancel the in-flight Cursor Run for a session. No-op if none running. */
  cancelBuild(args: {
    sessionId: string;
    reason: string;
  }): Promise<{ ok: boolean }>;
}

let _hooks: OrchestratorHooks | null = null;
export function setOrchestratorHooks(hooks: OrchestratorHooks): void {
  _hooks = hooks;
}

const TOKEN_TTL_SECONDS = 10 * 60;

let _convex: ConvexHttpClient | null = null;
function convex(): ConvexHttpClient | null {
  if (_convex) return _convex;
  const url = process.env.CONVEX_URL;
  if (!url) return null; // Convex is optional in the LiveKit-only smoke path.
  _convex = new ConvexHttpClient(url);
  return _convex;
}

let _dispatchClient: AgentDispatchClient | null = null;
function dispatchClient(): AgentDispatchClient | null {
  if (_dispatchClient) return _dispatchClient;
  const url = process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!url || !apiKey || !apiSecret) return null;
  // AgentDispatchClient wants the HTTPS host, not the wss URL. Convert.
  const host = url.replace(/^wss?:\/\//i, "https://");
  _dispatchClient = new AgentDispatchClient(host, apiKey, apiSecret);
  return _dispatchClient;
}

function readEnvOrThrow(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set in the orchestrator env`);
  return v;
}

function makeIdentity(): string {
  return `user-${Math.random().toString(36).slice(2, 10)}`;
}

function makeRoomName(sessionId: string): string {
  return `nexus-${sessionId}`;
}

/** Mint a LiveKit JWT that joins one room. */
async function mintToken(opts: {
  apiKey: string;
  apiSecret: string;
  identity: string;
  roomName: string;
  sessionId: string;
}): Promise<string> {
  const { apiKey, apiSecret, identity, roomName, sessionId } = opts;
  const at = new AccessToken(apiKey, apiSecret, {
    identity,
    ttl: TOKEN_TTL_SECONDS,
  });
  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    canUpdateOwnMetadata: true,
  });
  // Phase 4: dispatch is now done via AgentDispatchClient (Twirp). We still
  // stash sessionId in metadata as a fallback — the worker reads it as a
  // fall-through if it can't find it on the dispatch's own metadata.
  at.metadata = JSON.stringify({ sessionId });
  return at.toJwt();
}

/**
 * Phase 4: explicit per-room agent dispatch via Twirp. Replaces the Phase 3
 * JWT workaround that auto-joined every room with empty `agent_name`.
 *
 * Returns true on success, false on any failure. We never let dispatch
 * errors block token mint — the worker can still be set to auto-join (empty
 * `agent_name`) as a fallback during local dev.
 */
async function dispatchAgentToRoom(opts: {
  agentName: string;
  roomName: string;
  sessionId: string;
}): Promise<boolean> {
  const client = dispatchClient();
  if (!client) return false;
  try {
    await client.createDispatch(opts.roomName, opts.agentName, {
      metadata: JSON.stringify({ sessionId: opts.sessionId }),
    });
    return true;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(
      `[livekit] AgentDispatchClient.createDispatch failed for room=${opts.roomName} agent=${opts.agentName}:`,
      e,
    );
    return false;
  }
}

/**
 * If sessionId is missing or invalid, lazily create one via Convex so the
 * agent has somewhere to write avatarState. If Convex isn't configured, fall
 * back to a synthetic id so the smoke path still works.
 */
async function ensureSessionId(raw: string | undefined): Promise<SessionId> {
  const client = convex();
  if (!client) {
    // No Convex: return a placeholder. The agent will skip state writes.
    return ((raw as SessionId) ?? ("smoke-no-convex" as SessionId));
  }
  if (raw) {
    try {
      const existing = await client.query(api.sessions.get, {
        sessionId: raw as SessionId,
      });
      if (existing) return raw as SessionId;
    } catch {
      // fall through to create
    }
  }
  const id: SessionId = await client.mutation(api.sessions.ensureVoiceSession, {});
  return id;
}

export function registerLiveKitRoutes(fastify: FastifyInstance): void {
  fastify.post<{ Body: TokenRequestBody; Reply: TokenResponseBody | { error: string } }>(
    "/api/livekit/token",
    async (
      req: FastifyRequest<{ Body: TokenRequestBody }>,
      reply: FastifyReply,
    ) => {
      let apiKey: string;
      let apiSecret: string;
      let url: string;
      try {
        apiKey = readEnvOrThrow("LIVEKIT_API_KEY");
        apiSecret = readEnvOrThrow("LIVEKIT_API_SECRET");
        url = readEnvOrThrow("LIVEKIT_URL");
      } catch (e) {
        return reply.code(500).send({ error: (e as Error).message });
      }
      const agentName = process.env.LIVEKIT_AGENT_NAME ?? "nexus-voice-agent";

      const body = req.body ?? {};
      const sessionId = await ensureSessionId(body.sessionId);
      const identity = body.identity ?? makeIdentity();
      const roomName = makeRoomName(sessionId);

      try {
        const token = await mintToken({
          apiKey,
          apiSecret,
          identity,
          roomName,
          sessionId,
        });
        // Phase 4: explicit dispatch. Best-effort — we don't fail the token
        // mint if dispatch fails; the worker can still auto-join with empty
        // agent_name if explicit dispatch is misconfigured locally.
        const agentDispatched = await dispatchAgentToRoom({
          agentName,
          roomName,
          sessionId,
        });
        return reply.send({
          token,
          url,
          room: roomName,
          identity,
          sessionId,
          agentName,
          agentDispatched,
        });
      } catch (e) {
        req.log.error({ err: e }, "mintToken failed");
        return reply.code(500).send({ error: (e as Error).message });
      }
    },
  );

  fastify.post<{ Body: AvatarStateBody }>(
    "/api/avatar/state",
    async (req, reply) => {
      const body = req.body ?? ({} as AvatarStateBody);
      if (!body.sessionId || !body.avatarState) {
        return reply.code(400).send({ error: "sessionId and avatarState required" });
      }
      const allowed = new Set(["idle", "listening", "thinking", "speaking"]);
      if (!allowed.has(body.avatarState)) {
        return reply.code(400).send({ error: `invalid avatarState: ${body.avatarState}` });
      }
      const client = convex();
      if (!client) {
        // No Convex configured — accept and ignore so smoke runs don't 500.
        req.log.warn("avatar/state received but CONVEX_URL not set; ignoring");
        return reply.code(204).send();
      }
      try {
        await client.mutation(api.sessions.updateAvatarState, {
          sessionId: body.sessionId as SessionId,
          avatarState: body.avatarState,
          livekitRoom: body.livekitRoom,
        });
      } catch (e) {
        req.log.warn({ err: e, body }, "updateAvatarState failed");
      }
      return reply.code(204).send();
    },
  );

  fastify.post<{ Body: ToolCallBody; Reply: ToolCallResponse | { error: string } }>(
    "/api/avatar/tool-call",
    async (req, reply) => {
      const body = req.body ?? ({} as ToolCallBody);
      if (!body.name) {
        return reply.code(400).send({ error: "name is required" });
      }
      const args = body.args ?? {};
      req.log.info({ tool: body.name, args, sessionId: body.sessionId }, "[phase4] tool-call");

      // Without orchestrator hooks we can't actually start a build; degrade
      // gracefully so the smoke path returns a 200 the agent can paraphrase.
      if (!_hooks) {
        req.log.warn("tool-call received but orchestrator hooks are not registered");
        return reply.send({
          ok: false,
          sessionId: body.sessionId ?? "",
          name: body.name,
          status: "ignored",
          reason: "hooks_unavailable",
        });
      }

      try {
        switch (body.name) {
          case "start_build": {
            const intent = typeof args.intent === "string" ? args.intent : "";
            if (!intent.trim()) {
              return reply.code(400).send({ error: "intent is required" });
            }
            const out = await _hooks.startBuild({
              sessionId: body.sessionId,
              intent,
            });
            return reply.send({
              ok: true,
              sessionId: out.sessionId,
              name: body.name,
              status: "started",
            });
          }
          case "modify_build": {
            const change = typeof args.change === "string" ? args.change : "";
            if (!body.sessionId) {
              return reply.code(400).send({
                error: "sessionId required for modify_build (no active build)",
              });
            }
            if (!change.trim()) {
              return reply.code(400).send({ error: "change is required" });
            }
            const out = await _hooks.modifyBuild({
              sessionId: body.sessionId,
              change,
            });
            return reply.send({
              ok: true,
              sessionId: out.sessionId,
              name: body.name,
              status: "queued",
            });
          }
          case "stop_build": {
            const reason =
              typeof args.reason === "string" ? args.reason : "user_cancel";
            if (!body.sessionId) {
              return reply.code(400).send({
                error: "sessionId required for stop_build",
              });
            }
            await _hooks.cancelBuild({ sessionId: body.sessionId, reason });
            return reply.send({
              ok: true,
              sessionId: body.sessionId,
              name: body.name,
              status: "cancelled",
            });
          }
          default: {
            req.log.warn({ name: body.name }, "unknown tool name");
            return reply.send({
              ok: false,
              sessionId: body.sessionId ?? "",
              name: body.name,
              status: "ignored",
              reason: "unknown_tool",
            });
          }
        }
      } catch (e) {
        req.log.error({ err: e, body }, "tool-call dispatch failed");
        return reply.code(500).send({ error: (e as Error).message });
      }
    },
  );

  // Phase 4.5: narration channel. The orchestrator's Cursor event loop calls
  // this whenever an `assistant_delta` fragment passes the rate-limit gate.
  // The handler writes the narration text into Convex (`sessions.narrationText`).
  // The LiveKit agent watches that field and triggers `session.say()` to make
  // the avatar speak the line. Convex is the side channel — no separate WS.
  fastify.post<{ Body: NarrateBody; Reply: { ok: boolean } | { error: string } }>(
    "/api/avatar/narrate",
    async (req, reply) => {
      const body = req.body ?? ({} as NarrateBody);
      if (!body.sessionId || !body.text || !body.text.trim()) {
        return reply.code(400).send({ error: "sessionId and non-empty text required" });
      }
      const client = convex();
      if (!client) {
        req.log.warn("narrate received but CONVEX_URL not set; ignoring");
        return reply.send({ ok: true });
      }
      try {
        await client.mutation(api.sessions.updateNarration, {
          sessionId: body.sessionId as SessionId,
          narrationText: body.text.trim(),
        });
      } catch (e) {
        req.log.warn({ err: e, body }, "updateNarration failed");
      }
      return reply.send({ ok: true });
    },
  );
}
