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
import type { NexusSandbox } from "./daytona.js";
import {
  appendLogs,
  pushEvent,
  type SessionId,
  updateSandbox,
  updateSessionState,
  upsertFile,
} from "./convex-pusher.js";

const SYSTEM_PROMPT = `You are Nexus, an AI pair-programmer. The user has described an application they want built.

Build the app in the current working directory. Use a single-file or small-tree layout that runs with \`npm install && npm start\`.

Strict requirements:
- The app MUST listen on port 3000 (read PORT from env, defaulting to 3000).
- The app's package.json MUST define a \`start\` script that runs the app in the foreground.
- Prefer plain Node.js with Express for backend tasks; for full-stack apps, prefer Vite + React with the dev server proxying to a separate Express backend on a single port.
- Keep the dependency tree minimal so npm install completes in < 30 seconds.
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
}

interface RunAgentResult {
  agentId: string;
  finishedOk: boolean;
  filesTouched: string[];
}

export async function runAgent(args: RunAgentArgs): Promise<RunAgentResult> {
  const { prompt, sandbox, sessionId, existingAgentId, cwd } = args;
  await fs.mkdir(cwd, { recursive: true });

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

  for await (const event of run.stream()) {
    switch (event.type) {
      case "assistant": {
        // Stream assistant text to Convex as separate events for narration.
        for (const block of event.message.content) {
          if (block.type === "text") {
            await pushEvent(sessionId, "assistant_delta", { text: block.text });
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

  const result = await run.wait();

  // Final pass: walk the cwd and pick up any file the tool-call detector missed.
  // This is a safety net for tool names we don't recognize.
  await syncMissedFiles({ cwd, sessionId, sandbox, tracker: filesTouched });

  // Now that all writes are in Daytona, kick off install + start.
  if (result.status === "finished") {
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
  try {
    await opts.sandbox.sdk.fs.uploadFile(Buffer.from(content, "utf8"), rel);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[cursor] failed to upload ${rel} to sandbox:`, err);
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
    try {
      await opts.sandbox.sdk.fs.uploadFile(Buffer.from(content, "utf8"), rel);
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
  // Reuse the sandbox session if it exists; create otherwise.
  try {
    await sandbox.sdk.process.createSession(sessionShellId);
  } catch {
    /* session already exists from a previous turn — that's fine */
  }

  // 1) npm install (always run — cheap on warm cache, idempotent).
  const install = await sandbox.sdk.process.executeSessionCommand(
    sessionShellId,
    {
      command: "cd /home/daytona && npm install --no-fund --no-audit",
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

  // 2) npm start in the background. Capture pid via a dedicated wrapper so we
  //    can kill it on follow-up turns if needed.
  const start = await sandbox.sdk.process.executeSessionCommand(
    sessionShellId,
    {
      command:
        "cd /home/daytona && (pkill -f 'node|next|vite' || true) && PORT=3000 nohup npm start > /tmp/nexus-app.log 2>&1 &",
      runAsync: true,
    },
  );

  // Give the dev server a moment to bind to port 3000.
  await new Promise((r) => setTimeout(r, 2500));

  // 3) Resolve preview URL and update Convex.
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

  // 4) Tail the app log to logs so the user sees runtime output.
  if (start.cmdId) {
    // Don't await — let it run in the background. Errors are swallowed.
    void tailAppLog({ sandbox, sessionId, sessionShellId, cmdId: start.cmdId });
  }
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
