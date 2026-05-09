"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { GhostButton } from "@/components/Button";
import { GlassPill } from "@/components/GlassPill";
import { IconArrow, IconBolt } from "@/components/icons";
import { Logo } from "@/components/Logo";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { SectionDivider } from "@/components/SectionDivider";

type RowProps = {
  label: string;
  sub?: string;
  children: ReactNode;
};

function Row({ label, sub, children }: RowProps) {
  return (
    <div
      className="profile-row"
      style={{
        display: "grid",
        gridTemplateColumns: "240px 1fr",
        gap: 32,
        padding: "18px 0",
        alignItems: "flex-start",
      }}
    >
      <div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: "var(--text-primary)",
          }}
        >
          {label}
        </div>
        {sub ? (
          <div
            style={{
              fontSize: 12.5,
              color: "var(--text-tertiary)",
              marginTop: 4,
              lineHeight: 1.5,
            }}
          >
            {sub}
          </div>
        ) : null}
      </div>
      <div>{children}</div>
    </div>
  );
}

const VOICES = [
  { id: "aiden", name: "Aiden", desc: "Calm, measured" },
  { id: "nova", name: "Nova", desc: "Warm, energetic" },
  { id: "kai", name: "Kai", desc: "Crisp, direct" },
] as const;

type VoiceId = (typeof VOICES)[number]["id"];

const USAGE: ReadonlyArray<{
  k: string;
  v: string;
  max?: string;
  pct?: number;
}> = [
  { k: "Voice minutes", v: "218", max: "500", pct: 0.43 },
  { k: "Sandboxes created", v: "37", max: "∞" },
  { k: "Code exports", v: "12" },
];

export default function ProfilePage() {
  const [voiceId, setVoiceId] = useState<VoiceId>("aiden");
  const [terminalLg, setTerminalLg] = useState(true);
  const [thinkingGlow, setThinkingGlow] = useState(true);
  const [ghToken, setGhToken] = useState("");
  const [oaiKey, setOaiKey] = useState("");

  return (
    <div
      className="page-fade-enter"
      style={{
        minHeight: "100vh",
        background: "var(--bg-canvas)",
        position: "relative",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(50% 30% at 50% -10%, rgba(0, 229, 255, 0.08), transparent 60%)",
        }}
      />

      {/* Top nav */}
      <nav
        className="glass"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          height: 56,
          display: "flex",
          alignItems: "center",
          padding: "0 24px",
          gap: 16,
        }}
      >
        <Link href="/workspace" style={{ textDecoration: "none" }}>
          <GhostButton style={{ padding: "8px 14px" }}>
            <IconArrow size={12} style={{ transform: "rotate(180deg)" }} />
            Back to workspace
          </GhostButton>
        </Link>
        <div style={{ flex: 1 }} />
        <Logo />
      </nav>

      <div
        className="profile-container"
        style={{
          maxWidth: 800,
          margin: "0 auto",
          padding: "60px 32px 120px",
          position: "relative",
        }}
      >
        {/* Header */}
        <div
          className="profile-header"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
            marginBottom: 40,
            flexWrap: "wrap",
          }}
        >
          <ProfileAvatar initials="AK" size={72} ring />
          <div>
            <div
              style={{
                fontSize: 11,
                color: "var(--accent-cyan)",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                fontWeight: 500,
                marginBottom: 6,
              }}
            >
              Account
            </div>
            <h1
              style={{
                fontSize: 30,
                fontWeight: 600,
                margin: 0,
                letterSpacing: "-0.02em",
              }}
            >
              Alex Kim
            </h1>
            <div
              style={{
                color: "var(--text-secondary)",
                fontSize: 14,
                marginTop: 2,
              }}
            >
              alex@kim.dev
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <GlassPill
            style={{
              padding: "8px 14px",
              fontSize: 12,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              border: "1px solid rgba(0, 229, 255, 0.4)",
              background: "rgba(0, 229, 255, 0.06)",
              boxShadow: "0 0 24px -8px rgba(0, 229, 255, 0.5)",
            }}
          >
            <IconBolt size={12} style={{ color: "var(--accent-cyan)" }} />
            <span style={{ fontWeight: 500 }}>Nexus Pro</span>
          </GlassPill>
        </div>

        {/* Account section */}
        <SectionDivider label="Account" />

        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 14,
            padding: 0,
            overflow: "hidden",
            marginBottom: 18,
          }}
        >
          <div
            style={{
              padding: "18px 22px",
              borderBottom: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>
                Usage this month
              </div>
              <div
                style={{
                  fontSize: 12.5,
                  color: "var(--text-tertiary)",
                  marginTop: 2,
                }}
              >
                Renews May 31
              </div>
            </div>
            <div style={{ flex: 1 }} />
            <a
              href="#manage"
              style={{
                fontSize: 13,
                color: "var(--accent-cyan)",
                textDecoration: "none",
              }}
            >
              Manage subscription →
            </a>
          </div>
          <div
            className="usage-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
            }}
          >
            {USAGE.map((m, i) => (
              <div
                key={m.k}
                style={{
                  padding: "20px 22px",
                  borderRight:
                    i < USAGE.length - 1
                      ? "1px solid var(--border-subtle)"
                      : "none",
                }}
              >
                <div
                  style={{
                    fontSize: 11.5,
                    color: "var(--text-tertiary)",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    fontWeight: 500,
                    marginBottom: 10,
                  }}
                >
                  {m.k}
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 6,
                  }}
                >
                  <span
                    style={{
                      fontSize: 28,
                      fontWeight: 600,
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {m.v}
                  </span>
                  {m.max ? (
                    <span
                      style={{
                        color: "var(--text-tertiary)",
                        fontSize: 13,
                      }}
                    >
                      / {m.max}
                    </span>
                  ) : null}
                </div>
                {m.pct !== undefined ? (
                  <div
                    style={{
                      height: 4,
                      borderRadius: 999,
                      background: "var(--border-subtle)",
                      marginTop: 12,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${m.pct * 100}%`,
                        height: "100%",
                        background:
                          "linear-gradient(90deg, var(--accent-cyan), var(--accent-purple))",
                        borderRadius: 999,
                        boxShadow: "0 0 8px rgba(0, 229, 255, 0.5)",
                      }}
                    />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        {/* Integrations */}
        <SectionDivider label="Integrations" />
        <div>
          <Row
            label="GitHub token"
            sub="Used when exporting code as a private repo. Stored encrypted."
          >
            <input
              className="field mono"
              type="password"
              value={ghToken}
              onChange={(e) => setGhToken(e.target.value)}
              placeholder="ghp_•••••••••••••••••"
            />
          </Row>
          <div style={{ height: 1, background: "var(--border-subtle)" }} />
          <Row
            label="Custom OpenAI key"
            sub="Bring your own. Bypasses Nexus token quotas for code generation."
          >
            <input
              className="field mono"
              type="password"
              value={oaiKey}
              onChange={(e) => setOaiKey(e.target.value)}
              placeholder="sk-•••••••••••••••••••••••••••••••••••"
            />
          </Row>
        </div>

        {/* Preferences */}
        <SectionDivider label="Preferences" />
        <Row label="Avatar voice" sub="The persona Nexus speaks with during sessions.">
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {VOICES.map((v) => {
              const selected = voiceId === v.id;
              return (
                <button
                  type="button"
                  key={v.id}
                  onClick={() => setVoiceId(v.id)}
                  style={{
                    padding: "12px 16px",
                    borderRadius: 12,
                    textAlign: "left",
                    background: selected
                      ? "rgba(0, 229, 255, 0.06)"
                      : "var(--bg-surface)",
                    border:
                      "1px solid " +
                      (selected
                        ? "rgba(0, 229, 255, 0.55)"
                        : "var(--border-subtle)"),
                    boxShadow: selected
                      ? "0 0 0 3px rgba(0, 229, 255, 0.08), 0 0 24px -8px rgba(0, 229, 255, 0.5)"
                      : "none",
                    color: "var(--text-primary)",
                    cursor: "pointer",
                    minWidth: 140,
                    transition: "all 200ms",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 999,
                        background: selected
                          ? "var(--accent-cyan)"
                          : "var(--border-strong)",
                        boxShadow: selected
                          ? "0 0 8px var(--accent-cyan)"
                          : "none",
                      }}
                    />
                    <span style={{ fontWeight: 500, fontSize: 14 }}>
                      {v.name}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 12,
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
        </Row>
        <div style={{ height: 1, background: "var(--border-subtle)" }} />
        <Row
          label="Larger terminal font"
          sub="Bumps xterm.js to 15px for readability on 4K displays."
        >
          <div
            style={{ display: "flex", alignItems: "center", gap: 12 }}
          >
            <button
              type="button"
              aria-pressed={terminalLg}
              aria-label="Toggle larger terminal font"
              className={`toggle ${terminalLg ? "on" : ""}`}
              onClick={() => setTerminalLg((t) => !t)}
            />
            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              {terminalLg ? "Enabled" : "Default size"}
            </span>
          </div>
        </Row>
        <div style={{ height: 1, background: "var(--border-subtle)" }} />
        <Row
          label="Thinking-state glow"
          sub="Animate the avatar's purple halo while it's planning."
        >
          <div
            style={{ display: "flex", alignItems: "center", gap: 12 }}
          >
            <button
              type="button"
              aria-pressed={thinkingGlow}
              aria-label="Toggle thinking-state glow"
              className={`toggle ${thinkingGlow ? "on" : ""}`}
              onClick={() => setThinkingGlow((t) => !t)}
            />
            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              {thinkingGlow ? "Enabled" : "Disabled"}
            </span>
          </div>
        </Row>

        {/* Danger Zone */}
        <SectionDivider label="Danger Zone" />
        <div
          className="danger-zone"
          style={{
            padding: 22,
            borderRadius: 14,
            border: "1px solid rgba(255, 68, 68, 0.3)",
            background: "rgba(255, 68, 68, 0.03)",
            display: "flex",
            alignItems: "center",
            gap: 24,
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: 1, minWidth: 240 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: "var(--text-primary)",
              }}
            >
              Delete account
            </div>
            <div
              style={{
                fontSize: 13,
                color: "var(--text-tertiary)",
                marginTop: 4,
              }}
            >
              Permanently deletes your sessions, sandboxes, and integrations.
              This cannot be undone.
            </div>
          </div>
          <button type="button" className="btn btn-danger">
            Delete account
          </button>
        </div>
      </div>
    </div>
  );
}
