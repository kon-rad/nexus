"use client";

import { useState } from "react";
import { IconChevron, IconFile, IconFolder } from "@/components/icons";
import { CODE_LINES, FILE_TREE, type CodeLine, type FileNode } from "./data";

function FileTreeNode({ node, depth = 0 }: { node: FileNode; depth?: number }) {
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
              <FileTreeNode key={`${c.type}-${c.name}-${i}`} node={c} depth={depth + 1} />
            ))
          : null}
      </div>
    );
  }
  const active = node.active === true;
  return (
    <div
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
        cursor: "pointer",
      }}
    >
      <IconFile size={12} style={{ color: "var(--text-tertiary)" }} />
      <span>{node.name}</span>
    </div>
  );
}

function renderTokens(line: CodeLine) {
  return line.tokens.map(([k, t], i) => (
    <span key={i} className={`tok-${k}`}>
      {t}
    </span>
  ));
}

/**
 * Static Code Inspection tab — file tree + Monaco-style editor with one
 * hard-coded TS file. CSS-only blinking cursor at the end of the last line.
 * Phase 2 swaps in real streamed content from Convex.
 */
export function CodeInspection() {
  const totalLines = CODE_LINES.length;
  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0 }}>
      <div
        style={{
          width: 220,
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
              color: "var(--accent-cyan)",
              fontSize: 10,
              background: "rgba(0, 229, 255, 0.08)",
              padding: "2px 6px",
              borderRadius: 4,
              letterSpacing: "0.04em",
            }}
          >
            IDLE
          </span>
        </div>
        {FILE_TREE.map((n, i) => (
          <FileTreeNode key={`${n.type}-${n.name}-${i}`} node={n} />
        ))}
      </div>

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
          <IconFolder size={11} />
          <span>src</span>
          <IconChevron size={10} />
          <span>components</span>
          <IconChevron size={10} />
          <span style={{ color: "var(--text-primary)" }}>TodoList.tsx</span>
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
          {CODE_LINES.map((line, i) => (
            <div key={i} className="code-line">
              <span className="code-gutter">{i + 1}</span>
              <span className="code-content">
                {renderTokens(line)}
                {i === CODE_LINES.length - 1 ? (
                  <span className="cursor-blink" />
                ) : null}
              </span>
            </div>
          ))}
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
          <span style={{ color: "var(--accent-cyan)" }}>● TypeScript React</span>
          <span>UTF-8</span>
          <span>LF</span>
          <div style={{ flex: 1 }} />
          <span>Ln {totalLines}, Col 1</span>
          <span>Saved</span>
        </div>
      </div>
    </div>
  );
}
