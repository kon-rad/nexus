"use client";

/**
 * Phase 4.10 — Settings modal.
 *
 * Three settings, all client-side, all persisted to localStorage:
 *
 *  - avatarVoice: Gemini voice ID picker (Puck / Charon / Aoede / Kore / Fenrir).
 *    Stored only; the live session's voice is set when the agent starts. We
 *    expose a "preview" hint and document that the change applies on the
 *    next session for the demo path.
 *  - terminalFontPx: xterm.js font size (12 / 14 / 16). Read by Insights.
 *  - thinkingGlow: bool — whether the avatar's purple glow animates.
 *
 * The state is mirrored to the <html> element via data-* attributes so
 * downstream consumers can react via CSS selectors and DOM reads without
 * prop-drilling.
 */

import { useEffect, useState, type CSSProperties } from "react";
import { GhostButton, PrimaryButton } from "@/components/Button";

const STORAGE_KEY = "nexus.settings.v1";

export type Settings = {
  avatarVoice: string;
  terminalFontPx: number;
  thinkingGlow: boolean;
};

const DEFAULTS: Settings = {
  avatarVoice: "Puck",
  terminalFontPx: 12,
  thinkingGlow: true,
};

const VOICE_OPTIONS: Array<{ id: string; desc: string }> = [
  { id: "Puck", desc: "Calm, measured" },
  { id: "Charon", desc: "Warm, deep" },
  { id: "Aoede", desc: "Bright, clear" },
  { id: "Kore", desc: "Crisp, direct" },
  { id: "Fenrir", desc: "Energetic" },
];

const FONT_OPTIONS = [12, 14, 16];

export function loadSettings(): Settings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      avatarVoice:
        typeof parsed.avatarVoice === "string" ? parsed.avatarVoice : DEFAULTS.avatarVoice,
      terminalFontPx:
        typeof parsed.terminalFontPx === "number" && FONT_OPTIONS.includes(parsed.terminalFontPx)
          ? parsed.terminalFontPx
          : DEFAULTS.terminalFontPx,
      thinkingGlow:
        typeof parsed.thinkingGlow === "boolean" ? parsed.thinkingGlow : DEFAULTS.thinkingGlow,
    };
  } catch {
    return DEFAULTS;
  }
}

function saveSettings(s: Settings): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* quota exceeded — silently no-op */
  }
}

export function applySettings(s: Settings): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.thinkingGlow = s.thinkingGlow ? "on" : "off";
  root.dataset.terminalFontPx = String(s.terminalFontPx);
  root.dataset.avatarVoice = s.avatarVoice;
}

export function SettingsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Settings>(DEFAULTS);

  useEffect(() => {
    if (open) setDraft(loadSettings());
  }, [open]);

  // Apply on save so the user sees live preview while the modal is open.
  const onSave = () => {
    saveSettings(draft);
    applySettings(draft);
    onClose();
  };

  // Live-preview the glow toggle while the modal is open.
  useEffect(() => {
    if (!open) return;
    applySettings(draft);
  }, [draft, open]);

  if (!open) return null;

  const overlayStyle: CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0, 0, 0, 0.6)",
    backdropFilter: "blur(6px)",
    zIndex: 100,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  const dialogStyle: CSSProperties = {
    width: "min(540px, 92vw)",
    background: "var(--bg-elevated)",
    border: "1px solid var(--border-subtle)",
    borderRadius: 16,
    padding: 28,
    boxShadow: "0 30px 80px -20px rgba(0,0,0,0.7)",
  };

  return (
    <div
      style={overlayStyle}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
    >
      <div style={dialogStyle}>
        <div
          style={{
            fontSize: 11,
            color: "var(--accent-cyan)",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            fontWeight: 500,
            marginBottom: 8,
          }}
        >
          Workspace
        </div>
        <h2
          style={{
            fontSize: 22,
            fontWeight: 600,
            margin: 0,
            letterSpacing: "-0.01em",
          }}
        >
          Settings
        </h2>
        <div
          style={{
            fontSize: 13,
            color: "var(--text-tertiary)",
            marginTop: 4,
          }}
        >
          These persist on this device. Avatar voice applies on the next session.
        </div>

        {/* Voice */}
        <SectionHeader>Avatar voice</SectionHeader>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {VOICE_OPTIONS.map((v) => {
            const active = draft.avatarVoice === v.id;
            return (
              <button
                type="button"
                key={v.id}
                onClick={() => setDraft({ ...draft, avatarVoice: v.id })}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  textAlign: "left",
                  background: active ? "rgba(0, 229, 255, 0.06)" : "var(--bg-surface)",
                  border:
                    "1px solid " + (active ? "rgba(0, 229, 255, 0.55)" : "var(--border-subtle)"),
                  color: "var(--text-primary)",
                  cursor: "pointer",
                  minWidth: 130,
                  transition: "all 200ms",
                }}
              >
                <div style={{ fontWeight: 500, fontSize: 13 }}>{v.id}</div>
                <div
                  style={{
                    fontSize: 11.5,
                    color: "var(--text-tertiary)",
                    marginTop: 4,
                  }}
                >
                  {v.desc}
                </div>
              </button>
            );
          })}
        </div>

        {/* Terminal font */}
        <SectionHeader>Terminal font size</SectionHeader>
        <div style={{ display: "flex", gap: 8 }}>
          {FONT_OPTIONS.map((px) => {
            const active = draft.terminalFontPx === px;
            return (
              <button
                type="button"
                key={px}
                onClick={() => setDraft({ ...draft, terminalFontPx: px })}
                style={{
                  padding: "8px 14px",
                  borderRadius: 10,
                  background: active ? "rgba(0, 229, 255, 0.06)" : "var(--bg-surface)",
                  border:
                    "1px solid " + (active ? "rgba(0, 229, 255, 0.55)" : "var(--border-subtle)"),
                  color: "var(--text-primary)",
                  cursor: "pointer",
                  fontFamily: "var(--font-jetbrains-mono), monospace",
                  fontSize: 12,
                }}
              >
                {px}px
              </button>
            );
          })}
        </div>

        {/* Glow */}
        <SectionHeader>Thinking-state glow</SectionHeader>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontSize: 13,
            color: "var(--text-secondary)",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={draft.thinkingGlow}
            onChange={(e) => setDraft({ ...draft, thinkingGlow: e.target.checked })}
            style={{ accentColor: "var(--accent-cyan)" }}
          />
          {draft.thinkingGlow ? "Enabled" : "Disabled"}
        </label>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 28 }}>
          <GhostButton onClick={onClose} style={{ padding: "8px 16px" }}>
            Cancel
          </GhostButton>
          <PrimaryButton onClick={onSave} style={{ padding: "8px 18px" }}>
            Save
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: "var(--text-tertiary)",
        fontWeight: 500,
        marginTop: 22,
        marginBottom: 10,
      }}
    >
      {children}
    </div>
  );
}
