import type { FastifyInstance } from "fastify";
import type { Id } from "../../../convex/_generated/dataModel.js";
import { configureFal, listModels, submitAndStream } from "./fal.js";

interface ListQuery {
  q?: string;
  category?: string;
}

interface RunBody {
  sessionId: string;
  endpointId: string;
  input: Record<string, unknown>;
}

/**
 * Routes consumed by the LiveKit agent's fal_tools.py.
 *
 *   GET  /api/fal/models?q=&category=     → { models: FalModel[] }
 *   POST /api/fal/run    { sessionId, endpointId, input } → 202 { jobId }
 */
export function registerFalRoutes(fastify: FastifyInstance): void {
  // Configure best-effort. If FAL_KEY is missing, the routes still register
  // but /api/fal/run will fail at submit time with a clear error. /api/fal/models
  // works without auth (lower rate limits).
  try {
    configureFal();
  } catch (err) {
    fastify.log.warn(
      { err: (err as Error).message },
      "fal SDK not configured at boot — set FAL_KEY to enable /api/fal/run",
    );
  }

  fastify.get<{ Querystring: ListQuery }>("/api/fal/models", async (req) => {
    const models = await listModels({
      q: req.query.q,
      category: req.query.category,
    });
    return {
      models: models.map((m) => ({
        endpoint_id: m.endpoint_id,
        display_name: m.metadata?.display_name,
        category: m.metadata?.category,
        description: m.metadata?.description,
        tags: m.metadata?.tags,
      })),
    };
  });

  fastify.post<{ Body: RunBody }>("/api/fal/run", async (req, reply) => {
    const body = req.body;
    if (!body || typeof body.sessionId !== "string" || typeof body.endpointId !== "string") {
      return reply.code(400).send({ error: "sessionId and endpointId are required" });
    }
    if (!body.input || typeof body.input !== "object") {
      return reply.code(400).send({ error: "input must be an object" });
    }
    const jobId = await submitAndStream({
      sessionId: body.sessionId as Id<"sessions">,
      endpointId: body.endpointId,
      input: body.input,
    });
    return reply.code(202).send({ jobId });
  });
}
