"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { IconChevron, IconFile, IconFolder } from "@/components/icons";
import {
  CODE_LINES,
  FILE_TREE,
  type CodeLine,
  type FileNode,
} from "./data";

type LiveFile = {
  _id: string;
  path: string;
  content: string;
  lastWrittenAt: number;
};

/**
 * Code Inspection tab. Phase 2 wires the file tree and editor body to live
 * Convex `files.bySession` data. The active file is the most-recently-written
 * one, which gives the user a "watch the agent code" feel without us having
 * to track tool calls in the UI.
 *
 * If no session is active, we render the Phase 1 mock so the panel still
 * looks complete on page load.
 */
export function CodeInspection({
  sessionId,
}: {
  sessionId: string | null;
}) {
  const filesRaw = useQuery(
    api.files.bySession,
    sessionId ? { sessionId: sessionId as Id<"sessions"> } : "skip",
  );
  // Memoize so the empty-array fallback is referentially stable across renders;
  // otherwise downstream useMemo's recompute every render.
  const files: ReadonlyArray<LiveFile> = useMemo(
    () => (filesRaw as LiveFile[] | undefined) ?? [],
    [filesRaw],
  );
  // A session exists — even if no files have been written yet. We use this to
  // suppress the marketing demo so users don't mistake a real (but file-less)
  // build for stale UI.
  const sessionActive = sessionId !== null;
  // Files have actually started landing.
  const live = sessionActive && files.length > 0;
  // Convex hasn't responded yet.
  const loading = sessionActive && filesRaw === undefined;

  // Active file: the most-recently-written file (files are returned newest-first).
  // The user can override by clicking another file in the tree.
  const [pickedPath, setPickedPath] = useState<string | null>(null);
  const newestPath = files[0]?.path ?? null;
  const activePath = pickedPath ?? newestPath;
  const activeFile = useMemo(
    () => files.find((f) => f.path === activePath),
    [files, activePath],
  );

  // Reset manual pick when session changes so a new session shows its newest file.
  useEffect(() => {
    setPickedPath(null);
  }, [sessionId]);

  // Build a synthetic tree from the flat file list.
  const liveTree = useMemo(() => buildTree(files.map((f) => f.path)), [files]);

  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0 }}>
      {/* SIDEBAR */}
      <div
        style={{
          width: 240,
          borderRight: "1px solid var(--border-subtle)",
          background: "var(--bg-surface)",
          padding: "14px 0",
          overflowY: "auto",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            padding: "0 14px 12px",
            fontSize: 11,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--text-tertiary)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontWeight: 500,
          }}
        >
          <span style={{ flex: 1 }}>Explorer</span>
          <span
            className="mono"
            style={{
              color: live ? "var(--accent-cyan)" : "var(--text-tertiary)",
              fontSize: 10,
              background: live
                ? "rgba(0, 229, 255, 0.08)"
                : "transparent",
              padding: "2px 6px",
              borderRadius: 4,
              letterSpacing: "0.04em",
              border: live
                ? "1px solid rgba(0, 229, 255, 0.3)"
                : "1px solid var(--border-subtle)",
            }}
          >
            {live ? "STREAMING" : sessionActive ? "WAITING" : "IDLE"}
          </span>
        </div>
        {live ? (
          liveTree.map((n, i) => (
            <FileTreeNode
              key={`${n.type}-${n.name}-${i}`}
              node={n}
              activePath={activePath ?? undefined}
              onPick={setPickedPath}
            />
          ))
        ) : sessionActive ? (
          <EmptyTree loading={loading} />
        ) : (
          FILE_TREE.map((n, i) => (
            <FileTreeNode key={`${n.type}-${n.name}-${i}`} node={n} />
          ))
        )}
      </div>

      {/* EDITOR */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            height: 30,
            display: "flex",
            alignItems: "center",
            padding: "0 18px",
            gap: 6,
            borderBottom: "1px solid var(--border-subtle)",
            fontSize: 12,
            color: "var(--text-tertiary)",
            fontFamily: "var(--font-jetbrains-mono), monospace",
            background: "rgba(0, 0, 0, 0.2)",
          }}
        >
          <Breadcrumbs
            path={
              activePath ??
              (sessionActive ? "(no files yet)" : "src/components/TodoList.tsx")
            }
          />
        </div>
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "10px 0",
            background: "var(--bg-canvas)",
            minHeight: 0,
          }}
        >
          {activeFile ? (
            <PlainSourceView content={activeFile.content} />
          ) : sessionActive ? (
            <EmptyEditor loading={loading} />
          ) : (
            <TokenView lines={CODE_LINES} />
          )}
          <div style={{ height: 80 }} />
        </div>
        <div
          style={{
            height: 26,
            display: "flex",
            alignItems: "center",
            padding: "0 14px",
            gap: 18,
            borderTop: "1px solid var(--border-subtle)",
            fontSize: 11,
            color: "var(--text-tertiary)",
            fontFamily: "var(--font-jetbrains-mono), monospace",
            background: "rgba(0, 0, 0, 0.3)",
          }}
        >
          <span style={{ color: "var(--accent-cyan)" }}>
            ●{" "}
            {activeFile
              ? detectLang(activeFile.path)
              : sessionActive
              ? "—"
              : "TypeScript React"}
          </span>
          <span>UTF-8</span>
          <span>LF</span>
          <div style={{ flex: 1 }} />
          <span>
            Ln{" "}
            {activeFile
              ? activeFile.content.split(/\r?\n/).length
              : sessionActive
              ? 0
              : CODE_LINES.length}
            , Col 1
          </span>
          <span>{live ? "Live" : sessionActive ? "Waiting" : "Saved"}</span>
        </div>
      </div>
    </div>
  );
}

/** Render a streamed file as plain text with line numbers. */
function PlainSourceView({ content }: { content: string }) {
  const lines = content.split(/\r?\n/);
  return (
    <>
      {lines.map((line, i) => (
        <div key={i} className="code-line">
          <span className="code-gutter">{i + 1}</span>
          <span className="code-content">{line || " "}</span>
        </div>
      ))}
    </>
  );
}

function EmptyTree({ loading }: { loading: boolean }) {
  return (
    <div
      style={{
        padding: "12px 14px",
        fontSize: 12,
        color: "var(--text-tertiary)",
        fontFamily: "var(--font-jetbrains-mono), monospace",
        letterSpacing: "0.02em",
        lineHeight: 1.6,
      }}
    >
      {loading
        ? "Loading files…"
        : "Waiting for the agent to write the first file."}
    </div>
  );
}

function EmptyEditor({ loading }: { loading: boolean }) {
  return (
    <div
      style={{
        padding: "24px 28px",
        color: "var(--text-tertiary)",
        fontFamily: "var(--font-jetbrains-mono), monospace",
        fontSize: 12.5,
        letterSpacing: "0.03em",
        lineHeight: 1.7,
      }}
    >
      <div style={{ color: "var(--text-secondary)", marginBottom: 6 }}>
        {loading ? "Loading session files…" : "No files written yet."}
      </div>
      <div>
        Files appear here in real time as the Cursor agent writes them. They are
        streamed via Convex (<span className="mono">files.bySession</span>).
      </div>
    </div>
  );
}

/** Render the Phase 1 token-colored mock (only used when no session is live). */
function TokenView({ lines }: { lines: ReadonlyArray<CodeLine> }) {
  return (
    <>
      {lines.map((line, i) => (
        <div key={i} className="code-line">
          <span className="code-gutter">{i + 1}</span>
          <span className="code-content">
            {line.tokens.map(([k, t], j) => (
              <span key={j} className={`tok-${k}`}>
                {t}
              </span>
            ))}
            {i === lines.length - 1 ? <span className="cursor-blink" /> : null}
          </span>
        </div>
      ))}
    </>
  );
}

function FileTreeNode({
  node,
  depth = 0,
  activePath,
  onPick,
}: {
  node: FileNode;
  depth?: number;
  activePath?: string;
  onPick?: (p: string) => void;
}) {
  const [open, setOpen] = useState(node.type === "folder" ? !!node.open : false);
  if (node.type === "folder") {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: `4px 8px 4px ${8 + depth * 12}px`,
            fontSize: 12.5,
            color: "var(--text-secondary)",
            cursor: "pointer",
            userSelect: "none",
            width: "100%",
            textAlign: "left",
            background: "transparent",
            border: "none",
          }}
        >
          <IconChevron
            size={11}
            style={{
              transform: open ? "rotate(90deg)" : "rotate(0)",
              transition: "transform 150ms",
              color: "var(--text-tertiary)",
            }}
          />
          <IconFolder size={13} style={{ color: "var(--text-tertiary)" }} />
          <span>{node.name}</span>
        </button>
        {open
          ? node.children.map((c, i) => (
              <FileTreeNode
                key={`${c.type}-${c.name}-${i}`}
                node={c}
                depth={depth + 1}
                activePath={activePath}
                onPick={onPick}
              />
            ))
          : null}
      </div>
    );
  }
  // We re-derive a path for click by walking up — instead we lift this to a
  // string-tagged file node when building from live data (see buildTree).
  const fullPath = (node as FileNode & { fullPath?: string }).fullPath;
  const active = fullPath ? fullPath === activePath : node.active === true;
  return (
    <div
      role={fullPath ? "button" : undefined}
      onClick={() => {
        if (fullPath && onPick) onPick(fullPath);
      }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: `4px 8px 4px ${24 + depth * 12}px`,
        fontSize: 12.5,
        color: active ? "var(--text-primary)" : "var(--text-secondary)",
        background: active ? "rgba(0, 229, 255, 0.07)" : "transparent",
        borderLeft: active
          ? "2px solid var(--accent-cyan)"
          : "2px solid transparent",
        marginLeft: active ? -2 : 0,
        cursor: fullPath ? "pointer" : "default",
      }}
    >
      <IconFile size={12} style={{ color: "var(--text-tertiary)" }} />
      <span>{node.name}</span>
    </div>
  );
}

function Breadcrumbs({ path }: { path: string }) {
  const segments = path.split("/").filter(Boolean);
  if (segments.length === 0) return null;
  return (
    <>
      {segments.map((s, i) => {
        const last = i === segments.length - 1;
        return (
          <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            {i > 0 ? <IconChevron size={10} /> : null}
            <span style={{ color: last ? "var(--text-primary)" : undefined }}>{s}</span>
          </span>
        );
      })}
    </>
  );
}

function detectLang(path: string): string {
  if (path.endsWith(".tsx")) return "TypeScript React";
  if (path.endsWith(".ts")) return "TypeScript";
  if (path.endsWith(".jsx")) return "JavaScript React";
  if (path.endsWith(".js")) return "JavaScript";
  if (path.endsWith(".json")) return "JSON";
  if (path.endsWith(".html")) return "HTML";
  if (path.endsWith(".css")) return "CSS";
  if (path.endsWith(".md")) return "Markdown";
  return "Plain text";
}

type LiveFolderNode = Extract<FileNode, { type: "folder" }> & { open: true };
type LiveFileNode = Extract<FileNode, { type: "file" }> & { fullPath: string };

/** Build a FileNode tree from a flat list of file paths. */
function buildTree(paths: ReadonlyArray<string>): FileNode[] {
  const root: Record<string, unknown> = {};
  for (const p of paths) {
    const parts = p.split("/").filter(Boolean);
    let cursor: Record<string, unknown> = root;
    for (let i = 0; i < parts.length; i++) {
      const segment = parts[i];
      if (!segment) continue;
      const isLeaf = i === parts.length - 1;
      if (isLeaf) {
        cursor[segment] = { __file: p };
      } else {
        if (!cursor[segment] || typeof cursor[segment] !== "object") {
          cursor[segment] = {};
        }
        cursor = cursor[segment] as Record<string, unknown>;
      }
    }
  }
  return toNodes(root).sort(folderFirst);
}

function toNodes(obj: Record<string, unknown>): FileNode[] {
  const out: FileNode[] = [];
  for (const [name, val] of Object.entries(obj)) {
    if (val && typeof val === "object" && "__file" in (val as object)) {
      const file: LiveFileNode = {
        type: "file",
        name,
        fullPath: (val as { __file: string }).__file,
      };
      out.push(file);
    } else if (val && typeof val === "object") {
      const folder: LiveFolderNode = {
        type: "folder",
        name,
        open: true,
        children: toNodes(val as Record<string, unknown>).sort(folderFirst),
      };
      out.push(folder);
    }
  }
  return out;
}

function folderFirst(a: FileNode, b: FileNode): number {
  if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
  return a.name.localeCompare(b.name);
}
