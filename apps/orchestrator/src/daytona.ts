/**
 * Daytona sandbox lifecycle helpers.
 *
 * The orchestrator owns one sandbox per session. We create it on first prompt,
 * reuse it on follow-ups (multi-turn — see `getOrCreateSandbox`), and tear it
 * down on session end.
 *
 * Generated code lives in the sandbox's filesystem. The orchestrator never
 * writes to its own disk: every `fs.writeFile` extracted from a Cursor tool
 * call gets mirrored here via `sandbox.fs.uploadFile()`.
 */

import { Daytona, type Sandbox } from "@daytona/sdk";

let _client: Daytona | null = null;

function getClient(): Daytona {
  if (_client) return _client;
  const apiKey = process.env.DAYTONA_API_KEY;
  if (!apiKey) {
    throw new Error(
      "DAYTONA_API_KEY is not set. Add it to apps/orchestrator/.env.",
    );
  }
  _client = new Daytona({
    apiKey,
    apiUrl: process.env.DAYTONA_API_URL,
  });
  return _client;
}

export interface NexusSandbox {
  /** Daytona-issued sandbox id. */
  sandboxId: string;
  /** The underlying SDK handle, kept around for fs/process calls. */
  sdk: Sandbox;
  /**
   * Resolve a signed preview URL for a port the generated app is listening on.
   * Daytona auto-opens the port if closed; the URL stays valid for the
   * sandbox's lifetime.
   */
  getPreviewUrl: (port: number) => Promise<{ url: string; token?: string }>;
}

/**
 * Spin up a fresh Node.js sandbox and return a thin wrapper. Cold-start is
 * sub-second per Daytona's docs (~90ms hot, a couple seconds cold).
 *
 * We label sandboxes with the session id so a later orchestrator restart can
 * find them via `daytona.list({ "nexus-session": sessionId })`.
 */
export async function createSandbox(sessionId: string): Promise<NexusSandbox> {
  const daytona = getClient();
  const sandbox = await daytona.create({
    language: "typescript",
    autoStopInterval: 30,
    labels: { "nexus-session": sessionId },
    envVars: {
      NODE_ENV: "development",
    },
  });
  return wrap(sandbox);
}

/**
 * Multi-turn entry point: look up an existing sandbox by id (from a previous
 * Convex `sandbox` row) and reuse it, otherwise create one. Resolves Q4
 * (multi-turn sandbox state) — same sandbox, same files, same running dev
 * server across follow-up prompts.
 */
export async function getOrCreateSandbox(
  sessionId: string,
  existingSandboxId: string | undefined,
): Promise<NexusSandbox> {
  if (!existingSandboxId) return createSandbox(sessionId);
  const daytona = getClient();
  try {
    const sandbox = await daytona.get(existingSandboxId);
    // Daytona auto-stops idle sandboxes; bring them back if needed.
    const state = (sandbox as { state?: string }).state;
    if (state && state !== "started" && state !== "running") {
      try {
        await daytona.start(sandbox);
      } catch {
        /* If start fails (e.g. archived), fall through to create a fresh one. */
        return createSandbox(sessionId);
      }
    }
    return wrap(sandbox);
  } catch {
    return createSandbox(sessionId);
  }
}

function wrap(sdk: Sandbox): NexusSandbox {
  return {
    sandboxId: sdk.id,
    sdk,
    getPreviewUrl: async (port: number) => {
      const link = await sdk.getPreviewLink(port);
      return { url: link.url, token: link.token };
    },
  };
}

/** Best-effort delete for clean session end. Errors are swallowed and logged. */
export async function deleteSandbox(sandboxId: string): Promise<void> {
  try {
    const daytona = getClient();
    const sandbox = await daytona.get(sandboxId);
    await daytona.delete(sandbox);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[daytona] failed to delete ${sandboxId}:`, err);
  }
}
