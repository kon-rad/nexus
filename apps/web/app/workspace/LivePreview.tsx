"use client";

import { useState } from "react";
import { IconCopy, IconLock } from "@/components/icons";

const PREVIEW_URL = "preview-7f3a-ax21.daytona.dev";

/**
 * Static fake-browser shell with a Copy URL button. Iframe stub points at
 * about:blank — Phase 2 replaces this with a real Daytona preview URL.
 */
export function LivePreview() {
  const [copied, setCopied] = useState(false);

  const onCopy = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(`https://${PREVIEW_URL}`);
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
          }}
        >
          <IconLock size={11} style={{ color: "var(--text-success)" }} />
          <span style={{ color: "var(--text-tertiary)" }}>https://</span>
          <span>{PREVIEW_URL}</span>
          <div style={{ flex: 1 }} />
          <span
            style={{
              fontSize: 10,
              padding: "1px 7px",
              borderRadius: 999,
              background: "rgba(0, 255, 133, 0.12)",
              color: "var(--text-success)",
              border: "1px solid rgba(0, 255, 133, 0.3)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            live
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

      {/* Iframe stub — Phase 2 swaps the src for the Daytona signed URL. */}
      <iframe
        title="Live preview"
        src="about:blank"
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
