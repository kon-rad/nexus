/**
 * Phase 3 — LiveKit token mint + avatar-state surface for the LiveKit agent.
 *
 * Three endpoints:
 *
 *   POST /api/livekit/token       { sessionId? } → { token, url, room, identity }
 *     Mints a short-lived JWT for the browser. Grants room subscribe + mic
 *     publish, and stamps an agent dispatch for `LIVEKIT_AGENT_NAME` so the
 *     Python worker is automatically jobbed into the room. If sessionId is
 *     missing, lazily creates a Convex session (ensureVoiceSession) so the
 *     agent has somewhere to write avatarState.
 *
 *   POST /api/avatar/state        { sessionId, avatarState, livekitRoom? }
 *     Called by the LiveKit agent on every agent_state_changed event.
 *     Mirrors the value into Convex sessions.avatarState; the workspace's
 *     useQuery hook re-renders the StatusBadge.
 *
 *   POST /api/avatar/tool-call    { sessionId, name, args }
 *     Phase 3 stub. Logs the call. Phase 4 routes start_build → /api/session.
 *
 * Secrets stay here. The browser only ever sees the JWT, scoped to one room.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { AccessToken } from "livekit-server-sdk";
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

const TOKEN_TTL_SECONDS = 10 * 60;

let _convex: ConvexHttpClient | null = null;
function convex(): ConvexHttpClient | null {
  if (_convex) return _convex;
  const url = process.env.CONVEX_URL;
  if (!url) return null; // Convex is optional in the LiveKit-only smoke path.
  _convex = new ConvexHttpClient(url);
  return _convex;
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

/** Mint a LiveKit JWT that joins one room and dispatches the Nexus agent. */
async function mintToken(opts: {
  apiKey: string;
  apiSecret: string;
  identity: string;
  roomName: string;
  agentName: string;
  sessionId: string;
}): Promise<string> {
  const { apiKey, apiSecret, identity, roomName, agentName, sessionId } = opts;
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
  });
  // Stash sessionId in participant metadata. The LiveKit agent reads it from
  // the room's first participant. Avoids RoomAgentDispatch's "deployment"
  // field, which livekit-server v1.11 rejects when seen in JWT JSON. Still
  // dispatches the agent automatically because the worker matches on
  // `agent_name` and our worker is registered with that name.
  at.metadata = JSON.stringify({ sessionId, agentName });
  return at.toJwt();
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
          agentName,
          sessionId,
        });
        return reply.send({
          token,
          url,
          room: roomName,
          identity,
          sessionId,
          agentName,
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

  fastify.post<{ Body: ToolCallBody }>(
    "/api/avatar/tool-call",
    async (req, reply) => {
      const body = req.body ?? ({} as ToolCallBody);
      if (!body.sessionId || !body.name) {
        return reply.code(400).send({ error: "sessionId and name required" });
      }
      // Phase 3: log only. Phase 4 routes start_build to /api/session.
      req.log.info({ tool: body.name, args: body.args }, "[phase3] tool-call");
      return reply.code(204).send();
    },
  );
}
