"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { IconCopy, IconLock } from "@/components/icons";

const PLACEHOLDER_HOST = "preview-7f3a-ax21.daytona.dev";

/**
 * Live Preview tab. Phase 2 reads the active session's `sandbox.previewUrl`
 * from Convex. The fake browser URL bar shows the real signed Daytona URL,
 * the iframe renders it, and the Copy button copies the full URL.
 *
 * If no session is active yet, we render the original placeholder host so
 * the panel has something to show during a fresh page load.
 */
export function LivePreview({ sessionId }: { sessionId: string | null }) {
  const sandbox = useQuery(
    api.sandbox.bySession,
    sessionId ? { sessionId: sessionId as Id<"sessions"> } : "skip",
  );
  const session = useQuery(
    api.sessions.get,
    sessionId ? { sessionId: sessionId as Id<"sessions"> } : "skip",
  );
  const [copied, setCopied] = useState(false);

  // Phase 4.7: bump a key on each PREVIEW transition so the iframe reloads
  // even when previewUrl is unchanged across a modify_build cycle.
  const [refreshKey, setRefreshKey] = useState(0);
  const lastStateRef = useRef<string | null>(null);
  useEffect(() => {
    const next = (session?.state as string | undefined) ?? null;
    if (next === "PREVIEW" && lastStateRef.current !== "PREVIEW") {
      setRefreshKey((k) => k + 1);
    }
    lastStateRef.current = next;
  }, [session?.state]);

  const previewUrl = sandbox?.previewUrl ?? null;
  const displayHost = previewUrl
    ? safeHost(previewUrl)
    : PLACEHOLDER_HOST;
  const live = !!previewUrl;

  const onCopy = () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    if (previewUrl) {
      void navigator.clipboard.writeText(previewUrl);
    } else {
      void navigator.clipboard.writeText(`https://${PLACEHOLDER_HOST}`);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

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
          height: 40,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "0 14px",
          borderBottom: "1px solid var(--border-subtle)",
          background: "rgba(0, 0, 0, 0.3)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", gap: 6 }}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              background: "var(--border-subtle)",
            }}
          />
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              background: "var(--border-subtle)",
            }}
          />
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              background: "var(--border-subtle)",
            }}
          />
        </div>
        <div
          className="mono"
          style={{
            flex: 1,
            height: 26,
            borderRadius: 999,
            background: "var(--bg-canvas)",
            border: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "0 12px",
            fontSize: 11.5,
            color: "var(--text-secondary)",
            minWidth: 0,
          }}
        >
          <IconLock size={11} style={{ color: "var(--text-success)" }} />
          <span style={{ color: "var(--text-tertiary)" }}>https://</span>
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
            }}
            title={previewUrl ?? PLACEHOLDER_HOST}
          >
            {displayHost}
          </span>
          <span
            style={{
              fontSize: 10,
              padding: "1px 7px",
              borderRadius: 999,
              background: live
                ? "rgba(0, 255, 133, 0.12)"
                : "rgba(255, 255, 255, 0.06)",
              color: live
                ? "var(--text-success)"
                : "var(--text-tertiary)",
              border: live
                ? "1px solid rgba(0, 255, 133, 0.3)"
                : "1px solid var(--border-subtle)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              flexShrink: 0,
            }}
          >
            {live ? "live" : "idle"}
          </span>
        </div>
        <button
          type="button"
          className="btn-icon"
          title="Copy URL"
          onClick={onCopy}
        >
          {copied ? (
            <span style={{ fontSize: 11, color: "var(--accent-cyan)" }}>✓</span>
          ) : (
            <IconCopy size={13} />
          )}
        </button>
      </div>

      {/*
        Iframe target. Defaults to about:blank when no session URL is available
        so we don't render a stale page across sessions. The src updates
        reactively via Convex when the orchestrator publishes a previewUrl.
      */}
      <iframe
        key={refreshKey}
        title="Live preview"
        src={previewUrl ?? "about:blank"}
        // sandbox + allow are needed because Daytona preview URLs serve user
        // code: scripts and forms must run, but we keep top-navigation and
        // pointer-lock locked down. See docs/iframe-decision.md.
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        style={{
          flex: 1,
          width: "100%",
          border: "none",
          background: "var(--bg-elevated)",
        }}
      />
    </div>
  );
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
