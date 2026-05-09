/**
 * fal.ai integration for the orchestrator.
 *
 * - listModels(): proxies https://api.fal.ai/v1/models with a 1-hour memory cache.
 * - submitAndStream(): submits a model invocation, subscribes to queue updates,
 *   pushes every transition into Convex, and resolves with the final output.
 *
 * The agent talks to us over HTTP (see fal-routes.ts). It never holds FAL_KEY.
 */
import { fal } from "@fal-ai/client";
import {
  enqueueFalJob,
  setFalError,
  setFalOutput,
  updateFalJob,
  type FalJobId,
  type SessionId,
} from "./convex-pusher.js";

const MODELS_API = "https://api.fal.ai/v1/models";
const CACHE_TTL_MS = 60 * 60 * 1000;

interface FalModelMetadata {
  display_name?: string;
  category?: string;
  description?: string;
  status?: "active" | "deprecated";
  tags?: string[];
  thumbnail_url?: string;
  thumbnail_animated_url?: string;
}

export interface FalModel {
  endpoint_id: string;
  metadata?: FalModelMetadata;
}

interface FalModelsResponse {
  models: FalModel[];
  next_cursor: string | null;
  has_more: boolean;
}

let modelsCache: { fetchedAt: number; models: FalModel[] } | null = null;

/** Configure the SDK once on first import. */
export function configureFal(): void {
  const key = process.env.FAL_KEY;
  if (!key) {
    throw new Error(
      "FAL_KEY is not set. Add it to apps/orchestrator/.env before starting.",
    );
  }
  fal.config({ credentials: key });
}

/**
 * Returns the active models list, optionally filtered by free-text and category.
 * Caches the FIRST page (200 active models) for one hour to keep
 * `list_fal_models` voice-tool calls snappy.
 */
export async function listModels(opts: {
  q?: string;
  category?: string;
}): Promise<FalModel[]> {
  const all = await getActiveModelsCached();
  const q = opts.q?.toLowerCase().trim();
  const cat = opts.category?.toLowerCase().trim();
  return all.filter((m) => {
    if (cat && (m.metadata?.category ?? "").toLowerCase() !== cat) return false;
    if (q) {
      const hay = [
        m.endpoint_id,
        m.metadata?.display_name ?? "",
        m.metadata?.description ?? "",
        ...(m.metadata?.tags ?? []),
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

async function getActiveModelsCached(): Promise<FalModel[]> {
  if (modelsCache && Date.now() - modelsCache.fetchedAt < CACHE_TTL_MS) {
    return modelsCache.models;
  }
  const url = `${MODELS_API}?status=active&limit=200`;
  const res = await fetch(url, {
    headers: process.env.FAL_KEY
      ? { Authorization: `Key ${process.env.FAL_KEY}` }
      : {},
  });
  if (!res.ok) {
    throw new Error(`fal /v1/models returned ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as FalModelsResponse;
  modelsCache = { fetchedAt: Date.now(), models: json.models };
  return json.models;
}

/**
 * Submit a model invocation, mirror queue updates into Convex, and resolve
 * with the final output. Caller awaits this from the HTTP route, which itself
 * returns 202 + jobId immediately and lets this run in the background.
 */
export async function submitAndStream(args: {
  sessionId: SessionId;
  endpointId: string;
  input: Record<string, unknown>;
}): Promise<FalJobId> {
  const { sessionId, endpointId, input } = args;

  // Look up display_name + category from the cache so the UI has them
  // even before the queue lands.
  const all = await getActiveModelsCached().catch(() => [] as FalModel[]);
  const meta = all.find((m) => m.endpoint_id === endpointId)?.metadata;

  const jobId = await enqueueFalJob({
    sessionId,
    endpointId,
    displayName: meta?.display_name,
    category: meta?.category,
    input,
  });

  // Run the actual fal call in the background; HTTP responder doesn't await.
  void runJob({ jobId, endpointId, input }).catch(async (err) => {
    await setFalError(jobId, (err as Error).message ?? "unknown error");
  });

  return jobId;
}

async function runJob(args: {
  jobId: FalJobId;
  endpointId: string;
  input: Record<string, unknown>;
}): Promise<void> {
  const { jobId, endpointId, input } = args;

  const submitted = await fal.queue.submit(endpointId, { input });
  await updateFalJob(jobId, {
    status: "queued",
    requestId: submitted.request_id,
  });

  // subscribeToStatus polls fal for us and fires onQueueUpdate per transition.
  const final = await fal.queue.subscribeToStatus(endpointId, {
    requestId: submitted.request_id,
    logs: true,
    onQueueUpdate: (u) => {
      if (u.status === "IN_QUEUE") {
        void updateFalJob(jobId, {
          status: "queued",
          queuePosition: u.queue_position,
        });
      } else if (u.status === "IN_PROGRESS") {
        void updateFalJob(jobId, { status: "in_progress" });
      }
    },
  });

  if (final.status !== "COMPLETED") {
    throw new Error(`fal queue ended with status ${final.status}`);
  }

  const result = await fal.queue.result(endpointId, {
    requestId: submitted.request_id,
  });
  const output = result.data as Record<string, unknown>;
  const kind = detectOutputKind(output);
  await setFalOutput(jobId, output, kind);
}

/**
 * Heuristic: pick a renderer hint from the output JSON. The Generate tab's
 * switch matches these exact strings — keep them in lockstep.
 */
export function detectOutputKind(output: unknown): string {
  if (!output || typeof output !== "object") return "json";
  const o = output as Record<string, unknown>;

  const firstUrl = (val: unknown): string | undefined => {
    if (Array.isArray(val) && val.length > 0) {
      const head = val[0] as { url?: unknown } | string;
      if (typeof head === "string") return head;
      if (head && typeof head.url === "string") return head.url;
    }
    if (val && typeof val === "object") {
      const u = (val as { url?: unknown }).url;
      if (typeof u === "string") return u;
    }
    if (typeof val === "string") return val;
    return undefined;
  };

  if (firstUrl(o.images) || firstUrl(o.image)) return "image";
  if (firstUrl(o.video) || firstUrl(o.videos)) return "video";
  if (firstUrl(o.audio) || typeof o.audio_url === "string") return "audio";
  if (firstUrl(o.model_mesh) || typeof o.glb_url === "string") return "3d";
  if (typeof o.text === "string" || typeof o.output === "string") return "text";
  return "json";
}
