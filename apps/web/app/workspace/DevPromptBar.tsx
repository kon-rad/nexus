"use client";

import { useState, type FormEvent } from "react";

const ORCHESTRATOR_URL =
  process.env.NEXT_PUBLIC_ORCHESTRATOR_URL ?? "http://localhost:4000";

/**
 * Phase-2-only dev prompt bar. Sits at the top of the workspace right panel,
 * gated by `NEXT_PUBLIC_DEV_PROMPT_BAR=1`. Phase 4 removes this entirely once
 * the avatar is the input modality.
 *
 * On submit, posts to the orchestrator's `POST /api/session` and stores the
 * returned sessionId via `onSession`. The same sessionId is reused for
 * follow-up prompts so multi-turn (Q4) reuses the same Daytona sandbox and
 * the same Cursor agent context.
 */
export function DevPromptBar({
  sessionId,
  onSession,
}: {
  sessionId: string | null;
  onSession: (id: string) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`${ORCHESTRATOR_URL}/api/session`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          sessionId: sessionId ?? undefined,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status} ${text}`);
      }
      const json = (await res.json()) as { sessionId: string };
      onSession(json.sessionId);
      setPrompt("");
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      style={{
        display: "flex",
        gap: 8,
        alignItems: "center",
        padding: "8px 12px",
        borderBottom: "1px solid var(--border-subtle)",
        background: "rgba(0, 229, 255, 0.04)",
      }}
    >
      <span
        className="mono"
        title="Phase 2 dev-only — removed in Phase 4"
        style={{
          fontSize: 10,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--accent-cyan)",
          padding: "2px 6px",
          border: "1px solid rgba(0, 229, 255, 0.4)",
          borderRadius: 4,
          flexShrink: 0,
        }}
      >
        DEV
      </span>
      <input
        type="text"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={
          sessionId
            ? "Iterate on this app… (e.g. add a /health endpoint)"
            : "Build something… (e.g. an Express hello world on port 3000)"
        }
        disabled={busy}
        style={{
          flex: 1,
          minWidth: 0,
          height: 30,
          padding: "0 10px",
          fontSize: 13,
          background: "var(--bg-canvas)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 6,
          color: "var(--text-primary)",
          outline: "none",
          fontFamily: "inherit",
        }}
      />
      <button
        type="submit"
        disabled={busy || !prompt.trim()}
        style={{
          height: 30,
          padding: "0 14px",
          fontSize: 12,
          fontWeight: 500,
          background: busy ? "var(--bg-elevated)" : "var(--accent-cyan)",
          color: busy ? "var(--text-tertiary)" : "var(--bg-canvas)",
          border: "none",
          borderRadius: 6,
          cursor: busy ? "wait" : "pointer",
          flexShrink: 0,
        }}
      >
        {busy ? "Sending…" : sessionId ? "Iterate" : "Build"}
      </button>
      {sessionId ? (
        <span
          className="mono"
          style={{
            fontSize: 10,
            color: "var(--text-tertiary)",
            flexShrink: 0,
          }}
          title={sessionId}
        >
          {sessionId.slice(0, 8)}…
        </span>
      ) : null}
      {err ? (
        <span
          className="mono"
          style={{
            fontSize: 10,
            color: "var(--text-danger)",
            maxWidth: 280,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={err}
        >
          {err}
        </span>
      ) : null}
    </form>
  );
}
