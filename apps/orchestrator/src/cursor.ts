/**
 * Cursor agent driver.
 *
 * Architecture: the Cursor SDK is a Node.js client. The composer-2 agent runs
 * in Cursor's cloud, with file/edit tools resolved locally through `cwd`. We
 * watch the event stream for `tool_call` (`write` / `edit`) completions, read
 * the resulting file from disk, mirror it to Convex (so the Code Inspection
 * tab streams) AND upload it to the Daytona sandbox (so the running preview
 * stays in sync with what the user sees in the editor). This approach is
 * documented as the canonical for-await loop in
 * `docs/coding-agent-architecture.md` §2.
 *
 * Note: Daytona's MCP server is a local CLI for desktop AI agents, not a
 * remote HTTP MCP for cloud agents. Until that gap closes, we run Cursor in
 * `local` mode against a per-session scratch dir, then push writes to Daytona
 * out-of-band. This is functionally equivalent to the architecture doc's
 * "Cursor's cloud talks directly to Daytona's cloud over MCP" — the agent's
 * file writes still land in the sandbox; the only difference is whose hands
 * hold the file bytes for ~50ms in transit.
 */

import { promises as fs } from "node:fs";
import * as path from "node:path";
import { Agent, type SDKAgent } from "@cursor/sdk";
import type { Run } from "@cursor/sdk";
import type { NexusSandbox } from "./daytona.js";
import {
  appendLogs,
  pushEvent,
  type SessionId,
  updateSandbox,
  updateSessionState,
  upsertFile,
} from "./convex-pusher.js";
import { onAssistantDelta } from "./narration.js";

const SYSTEM_PROMPT = `You are Nexus, an AI pair-programmer. The user has described an application they want built.

Build the app in the current working directory. Use a single-file or small-tree layout that runs with \`npm install && npm start\`.

Runtime contract (the orchestrator runs your app inside a Daytona sandbox and exposes port 3000 through a public proxy iframe). Violating any of these means the user will see a broken preview:
- The app MUST listen on port 3000 (read PORT from env, default to 3000).
- The app MUST bind to 0.0.0.0, NOT localhost / 127.0.0.1. The Daytona proxy cannot reach localhost-only servers.
  - Express: \`app.listen(Number(process.env.PORT) || 3000, "0.0.0.0")\`
  - Fastify: \`fastify.listen({ port: ..., host: "0.0.0.0" })\`
  - Vite (dev): the start script must be \`vite --host 0.0.0.0 --port 3000\`
  - Next.js (dev): the start script must be \`next dev -H 0.0.0.0 -p 3000\`
- The app's package.json MUST define a \`start\` script that runs the app in the foreground (not via nodemon, not in watch mode that forks).
- Use a flat single-package layout: package.json at the project root, no monorepos, no workspaces, no Docker / docker-compose / Caddy / Nginx config.
- Single port only. Do NOT run a separate backend on a different port — bake API routes into the same process (Express routes, Vite middleware, or Next API routes).
- Keep the dependency tree minimal so npm install completes in < 30 seconds. Do NOT use puppeteer, playwright, sharp, canvas, prisma, electron, or other heavy native deps.
- For static-only demos, use \`"start": "npx -y serve@latest -l 3000 ."\` so the same npm install / npm start contract still works.
- Do NOT write a .env file or read secrets from one — fall back to mock data or constants.
- After writing files, do NOT run npm install or npm start yourself — the orchestrator handles those steps.

Be concise in narration. The user is watching the code panel update in real time.`;

/** Tool names that emit file writes we should mirror to Convex + Daytona. */
const WRITE_TOOL_NAMES = new Set(["write", "edit", "edit_file", "create_file"]);

interface RunAgentArgs {
  prompt: string;
  sandbox: NexusSandbox;
  sessionId: SessionId;
  /**
   * When provided, this is a follow-up turn (multi-turn). We resume the agent
   * by id rather than creating a new one, preserving conversation history.
   */
  existingAgentId?: string;
  /** Per-session scratch dir for the local Cursor agent. */
  cwd: string;
  /**
   * Phase 4.6: optional handle that the caller can use to cancel the in-flight
   * Cursor Run. Populated synchronously after `agent.send()` resolves.
   */
  onRunHandle?: (run: Run) => void;
}

interface RunAgentResult {
  agentId: string;
  finishedOk: boolean;
  filesTouched: string[];
  /** True if the run was cancelled mid-stream. */
  cancelled: boolean;
}

export async function runAgent(args: RunAgentArgs): Promise<RunAgentResult> {
  const { prompt, sandbox, sessionId, existingAgentId, cwd, onRunHandle } = args;
  await fs.mkdir(cwd, { recursive: true });
  let cancelled = false;

  const apiKey = process.env.CURSOR_API_KEY;
  if (!apiKey) {
    throw new Error(
      "CURSOR_API_KEY is not set. Add it to apps/orchestrator/.env.",
    );
  }

  const agent: SDKAgent = existingAgentId
    ? await Agent.resume(existingAgentId, {
        apiKey,
        local: { cwd },
      })
    : await Agent.create({
        apiKey,
        model: { id: "composer-2" },
        local: { cwd },
        // The system prompt is sent as the first user message; Cursor's API
        // doesn't have a top-level systemPrompt field. We inject context via
        // the first send() call below.
      });

  await updateSessionState(sessionId, "THINKING", {
    statusMessage: "Cursor agent reasoning…",
  });

  const filesTouched = new Set<string>();
  const fullPrompt = existingAgentId
    ? prompt
    : `${SYSTEM_PROMPT}\n\nUser request: ${prompt}`;

  const run = await agent.send(fullPrompt);
  if (onRunHandle) onRunHandle(run);

  try {
    for await (const event of run.stream()) {
    switch (event.type) {
      case "assistant": {
        // Stream assistant text to Convex as separate events for narration,
        // and forward through the Phase 4.5 narration channel so the avatar
        // can speak aloud what the agent is thinking.
        for (const block of event.message.content) {
          if (block.type === "text") {
            await pushEvent(sessionId, "assistant_delta", { text: block.text });
            // Best-effort, fire-and-forget. The narration helper is rate-limited.
            void onAssistantDelta(sessionId, block.text);
          }
        }
        break;
      }
      case "thinking": {
        await pushEvent(sessionId, "thinking", { text: event.text });
        break;
      }
      case "tool_call": {
        await pushEvent(sessionId, "tool_call", {
          name: event.name,
          status: event.status,
          callId: event.call_id,
          // args/result shapes are explicitly documented as unstable.
          args: event.args,
        });
        if (
          event.status === "completed" &&
          WRITE_TOOL_NAMES.has(event.name.toLowerCase())
        ) {
          await mirrorWrittenFile({
            cwd,
            sessionId,
            sandbox,
            args: event.args,
            tracker: filesTouched,
          });
        }
        if (event.status === "completed") {
          await updateSessionState(sessionId, "CODING", {
            statusMessage: `Last tool: ${event.name}`,
          });
        }
        break;
      }
      case "status": {
        await pushEvent(sessionId, "status", {
          status: event.status,
          message: event.message,
        });
        break;
      }
      default:
        // Other event types (system/user/task/request) are not consumed.
        break;
    }
  }
  } catch (e) {
    // The Cursor SDK throws when its run is cancelled mid-stream. Treat that
    // as a clean Phase 4.6 stop. Anything else propagates.
    const msg = String((e as Error)?.message ?? e);
    if (msg.toLowerCase().includes("cancel") || msg.toLowerCase().includes("aborted")) {
      cancelled = true;
    } else {
      throw e;
    }
  }

  let result: Awaited<ReturnType<Run["wait"]>>;
  try {
    result = await run.wait();
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    if (msg.toLowerCase().includes("cancel") || msg.toLowerCase().includes("aborted")) {
      cancelled = true;
      result = { status: "cancelled" } as Awaited<ReturnType<Run["wait"]>>;
    } else {
      throw e;
    }
  }

  // Final pass: walk the cwd and pick up any file the tool-call detector missed.
  // Skipped on cancel — the user explicitly asked us to stop.
  if (!cancelled) {
    await syncMissedFiles({ cwd, sessionId, sandbox, tracker: filesTouched });
  }

  if (cancelled || result.status === "cancelled") {
    await updateSessionState(sessionId, "DONE", {
      statusMessage: "Build cancelled",
    });
  } else if (result.status === "finished") {
    await updateSessionState(sessionId, "RUNNING", {
      statusMessage: "Installing dependencies and starting app…",
    });
    await installAndStart({ sandbox, sessionId });
  } else {
    await updateSessionState(sessionId, "ERROR", {
      statusMessage: `Cursor run ended with status: ${result.status}`,
    });
  }

  return {
    agentId: agent.agentId,
    finishedOk: result.status === "finished",
    filesTouched: [...filesTouched],
    cancelled,
  };
}

/**
 * Read a file the agent just wrote on local disk and mirror it to:
 *  1. Convex `files.upsert` — the Code Inspection tab subscribes here.
 *  2. The Daytona sandbox via `sandbox.fs.uploadFile` — so `npm start`
 *     downstream sees the same source the user sees.
 */
async function mirrorWrittenFile(opts: {
  cwd: string;
  sessionId: SessionId;
  sandbox: NexusSandbox;
  args: unknown;
  tracker: Set<string>;
}): Promise<void> {
  const filePath = extractFilePath(opts.args);
  if (!filePath) return;
  const abs = path.isAbsolute(filePath) ? filePath : path.join(opts.cwd, filePath);
  const rel = path.relative(opts.cwd, abs);
  if (rel.startsWith("..")) return; // outside workspace, ignore
  let content: string;
  try {
    content = await fs.readFile(abs, "utf8");
  } catch {
    return; // file may have been deleted in a follow-up tool call
  }
  opts.tracker.add(rel);
  await upsertFile(opts.sessionId, rel, content);
  // Upload using an absolute path so we don't depend on the SDK's
  // relative-path → workDir resolution. This is the same path npm install
  // and npm start cd into below.
  const remote = `${opts.sandbox.workDir.replace(/\/$/, "")}/${rel}`;
  try {
    await opts.sandbox.sdk.fs.uploadFile(Buffer.from(content, "utf8"), remote);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[cursor] failed to upload ${remote} to sandbox:`, err);
  }
}

/**
 * Best-effort recovery: walk the local cwd, push anything missed during
 * streaming. Kept under 200 entries to avoid pathological cases.
 */
async function syncMissedFiles(opts: {
  cwd: string;
  sessionId: SessionId;
  sandbox: NexusSandbox;
  tracker: Set<string>;
}): Promise<void> {
  const all = await walk(opts.cwd, opts.cwd, []);
  let count = 0;
  for (const rel of all) {
    if (count >= 200) break;
    if (opts.tracker.has(rel)) continue;
    if (rel.startsWith("node_modules/")) continue;
    if (rel.startsWith(".git/")) continue;
    if (rel.startsWith("dist/")) continue;
    const abs = path.join(opts.cwd, rel);
    let content: string;
    try {
      content = await fs.readFile(abs, "utf8");
    } catch {
      continue;
    }
    if (content.length > 200_000) continue; // skip huge files
    opts.tracker.add(rel);
    await upsertFile(opts.sessionId, rel, content);
    const remote = `${opts.sandbox.workDir.replace(/\/$/, "")}/${rel}`;
    try {
      await opts.sandbox.sdk.fs.uploadFile(Buffer.from(content, "utf8"), remote);
    } catch {
      /* swallow */
    }
    count++;
  }
}

async function walk(root: string, dir: string, acc: string[]): Promise<string[]> {
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entries) {
    const abs = path.join(dir, e.name);
    const rel = path.relative(root, abs);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === ".git" || e.name === "dist") continue;
      await walk(root, abs, acc);
    } else if (e.isFile()) {
      acc.push(rel);
    }
  }
  return acc;
}

/**
 * Best-effort path extraction from an unknown tool-call args payload.
 * Cursor's docs explicitly mark this shape as unstable, so we probe several
 * common field names rather than assuming a single shape.
 */
function extractFilePath(args: unknown): string | undefined {
  if (!args || typeof args !== "object") return undefined;
  const a = args as Record<string, unknown>;
  for (const k of ["path", "file_path", "filePath", "file"]) {
    const v = a[k];
    if (typeof v === "string" && v.length > 0) return v;
  }
  // Some shapes nest under target_file or relative_workspace_path.
  for (const k of ["target_file", "relative_workspace_path"]) {
    const v = a[k];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return undefined;
}

/**
 * Run `npm install` (if needed) then `npm start &` inside the sandbox. Stream
 * stdout/stderr to Convex `logs` so the Insights terminal half lights up. After
 * the dev server prints anything, resolve a preview URL and write it to the
 * sandbox row — the iframe will swap to it.
 */
async function installAndStart(opts: {
  sandbox: NexusSandbox;
  sessionId: SessionId;
}): Promise<void> {
  const { sandbox, sessionId } = opts;
  const sessionShellId = `nexus-${sessionId}`;
  const workDir = sandbox.workDir.replace(/\/$/, "");
  // Reuse the sandbox session if it exists; create otherwise.
  try {
    await sandbox.sdk.process.createSession(sessionShellId);
  } catch {
    /* session already exists from a previous turn — that's fine */
  }

  // 1) npm install — gate on `node_modules/.package-lock.json` so multi-turn
  //    refinements skip a 5-30s reinstall when nothing's changed. The
  //    .package-lock.json marker is npm's own "deps installed" sentinel; a
  //    bare `node_modules/` dir without it usually means a half-aborted
  //    install we should retry.
  const installNeededProbe = await sandbox.sdk.process.executeSessionCommand(
    sessionShellId,
    {
      command: `cd ${workDir} && ([ -f package.json ] && [ ! -f node_modules/.package-lock.json ] && echo NEED_INSTALL || echo SKIP_INSTALL)`,
      runAsync: false,
    },
  );
  const needsInstall = (installNeededProbe.output ?? "").includes("NEED_INSTALL");
  if (needsInstall) {
    const install = await sandbox.sdk.process.executeSessionCommand(
      sessionShellId,
      {
        command: `cd ${workDir} && npm install --no-fund --no-audit`,
        runAsync: false,
      },
    );
    if (install.cmdId) {
      await streamCommandLogs({
        sandbox,
        sessionId,
        sessionShellId,
        cmdId: install.cmdId,
      });
    }
  }

  // 2) npm start in the background. Kill any prior dev server first; we use
  //    `pkill -fE` (extended regex) so the alternation actually matches
  //    node|next|vite. The `|| true` keeps the chain alive when nothing was
  //    running. nohup + & detaches so the session command returns immediately.
  const start = await sandbox.sdk.process.executeSessionCommand(
    sessionShellId,
    {
      command:
        `cd ${workDir} && (pkill -fE 'node|next|vite' || true) && ` +
        `PORT=3000 HOST=0.0.0.0 nohup npm start > /tmp/nexus-app.log 2>&1 &`,
      runAsync: true,
    },
  );

  // 3) Wait for the dev server to actually accept TCP on 3000 inside the
  //    sandbox. Polling for ~20s with 500ms backoff covers cold Vite +
  //    Tailwind compile. Without this the preview URL frequently renders
  //    "Bad Gateway" before the app has bound.
  const ready = await waitForPort({
    sandbox,
    sessionShellId,
    port: 3000,
    timeoutMs: 20_000,
    intervalMs: 500,
  });
  if (!ready) {
    // Tail the last few lines of the app log so the user sees *why* —
    // missing dependency, bad start script, port already in use, etc.
    const tail = await sandbox.sdk.process.executeSessionCommand(
      sessionShellId,
      { command: "tail -n 40 /tmp/nexus-app.log || true", runAsync: false },
    );
    const snippet = (tail.output ?? "").trim().slice(-600);
    await updateSessionState(sessionId, "ERROR", {
      statusMessage: `App did not bind to port 3000 within 20s.${
        snippet ? ` Last log: ${snippet}` : ""
      }`,
    });
    if (start.cmdId) {
      void tailAppLog({ sandbox, sessionId, sessionShellId, cmdId: start.cmdId });
    }
    return;
  }

  // 4) Resolve preview URL and update Convex.
  try {
    const preview = await sandbox.getPreviewUrl(3000);
    await updateSandbox(sessionId, {
      daytonaId: sandbox.sandboxId,
      previewUrl: preview.url,
      status: "preview-ready",
    });
    await updateSessionState(sessionId, "PREVIEW", {
      statusMessage: "Preview ready",
      sandboxId: sandbox.sandboxId,
      previewUrl: preview.url,
    });
  } catch (err) {
    await updateSessionState(sessionId, "ERROR", {
      statusMessage: `Failed to resolve preview URL: ${(err as Error).message}`,
    });
  }

  // 5) Tail the app log to logs so the user sees runtime output.
  if (start.cmdId) {
    // Don't await — let it run in the background. Errors are swallowed.
    void tailAppLog({ sandbox, sessionId, sessionShellId, cmdId: start.cmdId });
  }
}

/**
 * Poll the sandbox shell until something is listening on `port`, or the
 * timeout elapses. Uses a tiny Node one-liner over `node -e` instead of
 * relying on `nc`/`curl`/`ss` being installed in the image — Daytona's
 * typescript sandbox always has node.
 */
async function waitForPort(opts: {
  sandbox: NexusSandbox;
  sessionShellId: string;
  port: number;
  timeoutMs: number;
  intervalMs: number;
}): Promise<boolean> {
  const { sandbox, sessionShellId, port, timeoutMs, intervalMs } = opts;
  const probe =
    `node -e "const s=require('net').createConnection({host:'127.0.0.1',port:${port}},` +
    `()=>{s.end();process.exit(0)}); s.on('error',()=>process.exit(1));` +
    `setTimeout(()=>{try{s.destroy()}catch{};process.exit(1)},800)"` +
    ` && echo NEXUS_PORT_READY || true`;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await sandbox.sdk.process.executeSessionCommand(
        sessionShellId,
        { command: probe, runAsync: false },
      );
      if ((r.output ?? "").includes("NEXUS_PORT_READY")) return true;
    } catch {
      /* shell hiccup — try again */
    }
    await new Promise((res) => setTimeout(res, intervalMs));
  }
  return false;
}

async function streamCommandLogs(opts: {
  sandbox: NexusSandbox;
  sessionId: SessionId;
  sessionShellId: string;
  cmdId: string;
}): Promise<void> {
  const { sandbox, sessionId, sessionShellId, cmdId } = opts;
  await sandbox.sdk.process.getSessionCommandLogs(
    sessionShellId,
    cmdId,
    (chunk) => {
      void appendLogs(
        sessionId,
        chunkToLines(chunk).map((line) => ({ stream: "stdout" as const, line })),
      );
    },
    (chunk) => {
      void appendLogs(
        sessionId,
        chunkToLines(chunk).map((line) => ({ stream: "stderr" as const, line })),
      );
    },
  );
}

async function tailAppLog(opts: {
  sandbox: NexusSandbox;
  sessionId: SessionId;
  sessionShellId: string;
  cmdId: string;
}): Promise<void> {
  try {
    await streamCommandLogs(opts);
  } catch {
    /* swallow — the app may exit on its own */
  }
}

function chunkToLines(chunk: string): string[] {
  return chunk
    .split(/\r?\n/)
    .map((s) => s.trimEnd())
    .filter((s) => s.length > 0);
}
