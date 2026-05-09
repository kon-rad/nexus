"use client";

/**
 * Phase 4.8 — Failure-mode banner.
 *
 * One-line UI surface that mirrors `docs/failure-modes.md`. Renders directly
 * below the top nav and above the tab content. Color-coded by severity:
 *
 *   - voice-unavailable / build-error : danger (red border + red text)
 *   - audio-only / build-cancelled    : warn (cyan border, neutral text)
 *   - convex-stale                    : info (purple, animated dot)
 *
 * The banner is intentionally just a banner — not a toast — so it doesn't
 * disappear behind a click. Operators can read it on stage; users see it
 * the whole time the failure is in effect.
 */

import type { CSSProperties } from "react";

export type BannerKind =
  | "convex-stale"
  | "voice-unavailable"
  | "audio-only"
  | "build-error"
  | "build-cancelled"
  | null;

const PALETTE: Record<
  Exclude<BannerKind, null>,
  { border: string; bg: string; text: string; dot: string }
> = {
  "voice-unavailable": {
    border: "rgba(255, 68, 68, 0.4)",
    bg: "rgba(255, 68, 68, 0.05)",
    text: "var(--danger-soft)",
    dot: "#FF4444",
  },
  "build-error": {
    border: "rgba(255, 68, 68, 0.4)",
    bg: "rgba(255, 68, 68, 0.05)",
    text: "var(--danger-soft)",
    dot: "#FF4444",
  },
  "audio-only": {
    border: "rgba(0, 229, 255, 0.3)",
    bg: "rgba(0, 229, 255, 0.04)",
    text: "var(--text-secondary)",
    dot: "var(--accent-cyan)",
  },
  "build-cancelled": {
    border: "rgba(176, 38, 255, 0.35)",
    bg: "rgba(176, 38, 255, 0.04)",
    text: "var(--text-secondary)",
    dot: "var(--accent-purple)",
  },
  "convex-stale": {
    border: "rgba(176, 38, 255, 0.35)",
    bg: "rgba(176, 38, 255, 0.04)",
    text: "var(--text-secondary)",
    dot: "var(--accent-purple)",
  },
};

export function FailureBanner({
  kind,
  text,
}: {
  kind: BannerKind;
  text: string;
}) {
  if (kind === null) return null;
  const p = PALETTE[kind];
  const style: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 16px",
    fontSize: 12,
    fontFamily: "var(--font-jetbrains-mono), monospace",
    letterSpacing: "0.04em",
    background: p.bg,
    color: p.text,
    borderTop: "1px solid var(--border-subtle)",
    borderBottom: `1px solid ${p.border}`,
  };
  return (
    <div role="status" aria-live="polite" style={style}>
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: p.dot,
          boxShadow: `0 0 8px ${p.dot}`,
          flexShrink: 0,
        }}
      />
      <span>{text}</span>
    </div>
  );
}
