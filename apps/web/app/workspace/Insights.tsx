"use client";

import { useEffect, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

const ReactMarkdown = dynamic(() => import("react-markdown"), { ssr: false });

type LiveEvent = {
  _id: string;
  type: string;
  payload: unknown;
  ts: number;
};

type LiveLog = {
  _id: string;
  stream: "stdout" | "stderr";
  line: string;
  ts: number;
};

/**
 * Insights tab. Phase 2 wires both halves to live Convex data:
 *   - top half: latest assistant_delta from `events.bySession`, rendered through react-markdown
 *   - bottom half: real xterm.js terminal fed by `logs.bySession`, color-coded
 *
 * If no session is active, we render the Phase 1 mock so the panel still
 * looks complete on a fresh page load.
 */
export function Insights({ sessionId }: { sessionId: string | null }) {
  const eventsRaw = useQuery(
    api.events.bySession,
    sessionId ? { sessionId: sessionId as Id<"sessions"> } : "skip",
  );
  const logsRaw = useQuery(
    api.logs.bySession,
    sessionId ? { sessionId: sessionId as Id<"sessions"> } : "skip",
  );

  const events: ReadonlyArray<LiveEvent> = useMemo(
    () => (eventsRaw as LiveEvent[] | undefined) ?? [],
    [eventsRaw],
  );
  const logs: ReadonlyArray<LiveLog> = useMemo(
    () => (logsRaw as LiveLog[] | undefined) ?? [],
    [logsRaw],
  );

  // Concatenate every assistant_delta in arrival order. This gives us a
  // running narration that matches what the agent has said so far.
  const explanation = useMemo(() => {
    const parts: string[] = [];
    for (const e of events) {
      if (e.type === "assistant_delta") {
        const p = e.payload as { text?: string } | null;
        if (p && typeof p.text === "string") parts.push(p.text);
      }
    }
    return parts.join("");
  }, [events]);

  const latestStatus = useMemo(() => {
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i];
      if (!e) continue;
      if (e.type === "status") {
        const p = e.payload as { status?: string } | null;
        if (p?.status) return p.status;
      }
    }
    return undefined;
  }, [events]);

  const live = sessionId !== null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "24px 28px",
          minHeight: 0,
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontSize: 11,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: live ? "var(--accent-purple)" : "var(--text-tertiary)",
            marginBottom: 14,
            fontWeight: 500,
          }}
        >
          <span className="status-dot thinking" />
          {live
            ? latestStatus
              ? `Nexus · ${latestStatus.toLowerCase()}`
              : "Nexus is thinking"
            : "Idle — start a session to see insights"}
        </div>
        {live && explanation ? (
          <div
            style={{
              color: "var(--text-secondary)",
              fontSize: 14.5,
              lineHeight: 1.65,
              maxWidth: 760,
            }}
            className="md-body"
          >
            <ReactMarkdown>{explanation}</ReactMarkdown>
          </div>
        ) : (
          <PlaceholderExplanation />
        )}
      </div>

      <TerminalPane logs={logs} live={live} />
    </div>
  );
}

/** xterm.js terminal pane — append-only, auto-scroll, color-coded. */
function TerminalPane({
  logs,
  live,
}: {
  logs: ReadonlyArray<LiveLog>;
  live: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<{ term: import("@xterm/xterm").Terminal; lastTs: number } | null>(null);

  // Mount the terminal once.
  useEffect(() => {
    let disposed = false;
    let term: import("@xterm/xterm").Terminal | undefined;
    let fit: import("@xterm/addon-fit").FitAddon | undefined;
    let resizeObs: ResizeObserver | undefined;

    void (async () => {
      const { Terminal } = await import("@xterm/xterm");
      const { FitAddon } = await import("@xterm/addon-fit");
      // Only inject the CSS in the browser, dynamically.
      // @ts-expect-error xterm.css has no type declarations
      await import("@xterm/xterm/css/xterm.css");

      if (disposed || !containerRef.current) return;

      // Phase 4.10: read user-selected font size from <html data-terminal-font-px>.
      const fontPx = (() => {
        if (typeof document === "undefined") return 12;
        const v = Number(document.documentElement.dataset.terminalFontPx);
        return Number.isFinite(v) && v > 0 ? v : 12;
      })();
      term = new Terminal({
        convertEol: true,
        cursorBlink: false,
        fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
        fontSize: fontPx,
        theme: {
          background: "#000000",
          foreground: "#E5E5E5",
          // Map xterm's named colors to our brand palette.
          green: "#00FF41",
          brightGreen: "#00FF41",
          red: "#FF4444",
          brightRed: "#FF4444",
          cyan: "#00E5FF",
          brightCyan: "#00E5FF",
          black: "#000000",
        },
        scrollback: 5000,
        disableStdin: true,
      });
      fit = new FitAddon();
      term.loadAddon(fit);
      term.open(containerRef.current);
      fit.fit();
      term.writeln("\x1b[2mNexus terminal — sandbox stdout / stderr will stream here.\x1b[0m");

      resizeObs = new ResizeObserver(() => {
        try {
          fit?.fit();
        } catch {
          /* container has no size — ignore */
        }
      });
      resizeObs.observe(containerRef.current);

      termRef.current = { term, lastTs: 0 };
    })();

    return () => {
      disposed = true;
      try {
        resizeObs?.disconnect();
      } catch {}
      try {
        term?.dispose();
      } catch {}
      termRef.current = null;
    };
  }, []);

  // Append only the new logs since `lastTs`. Convex returns the full set
  // each update; we diff to avoid re-printing the world.
  useEffect(() => {
    const ref = termRef.current;
    if (!ref) return;
    let appended = 0;
    for (const log of logs) {
      if (log.ts <= ref.lastTs) continue;
      ref.lastTs = log.ts;
      // ANSI: green for stdout, red for stderr, reset.
      const color = log.stream === "stderr" ? "\x1b[31m" : "\x1b[32m";
      const prefix = log.stream === "stderr" ? "[err] " : "";
      ref.term.writeln(`${color}${prefix}${log.line}\x1b[0m`);
      appended++;
    }
    if (appended > 0) {
      ref.term.scrollToBottom();
    }
  }, [logs]);

  return (
    <div
      style={{
        height: "40%",
        minHeight: 200,
        borderTop: "1px solid var(--border-subtle)",
        background: "#000",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          height: 30,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "0 14px",
          borderBottom: "1px solid var(--border-subtle)",
          fontSize: 11,
          color: "var(--text-tertiary)",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          flexShrink: 0,
        }}
      >
        <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>
          Terminal
        </span>
        <span
          className="mono"
          style={{
            textTransform: "none",
            letterSpacing: 0,
            color: "var(--text-tertiary)",
          }}
        >
          daytona@sandbox:~/app$
        </span>
        <div style={{ flex: 1 }} />
        <span
          style={{
            fontSize: 9.5,
            color: live ? "var(--text-success)" : "var(--text-tertiary)",
            letterSpacing: "0.08em",
          }}
        >
          {live ? "● connected" : "○ idle"}
        </span>
      </div>
      <div
        ref={containerRef}
        style={{
          flex: 1,
          padding: 6,
          background: "#000",
          minHeight: 0,
          overflow: "hidden",
        }}
      />
    </div>
  );
}

/** Phase 1 static explanation — kept as a no-session fallback. */
function PlaceholderExplanation() {
  return (
    <>
      <h3
        style={{
          fontSize: 20,
          fontWeight: 600,
          margin: "0 0 14px",
          letterSpacing: "-0.01em",
        }}
      >
        Tell Nexus what to build to see narration here.
      </h3>
      <div
        style={{
          color: "var(--text-secondary)",
          fontSize: 14.5,
          lineHeight: 1.65,
          maxWidth: 720,
        }}
      >
        <p style={{ marginTop: 0 }}>
          Once a session is live, this panel streams the agent's running
          commentary as it writes files and runs commands inside its sandbox.
          The terminal below mirrors stdout (
          <span style={{ color: "var(--text-success)" }}>green</span>) and
          stderr (<span style={{ color: "var(--text-danger)" }}>red</span>)
          from the sandbox.
        </p>
      </div>
    </>
  );
}
