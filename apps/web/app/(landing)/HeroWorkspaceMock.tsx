import { AvatarPresence } from "@/components/AvatarPresence";
import { GlassPill } from "@/components/GlassPill";
import { IconMic, IconPhone } from "@/components/icons";
import { StatusBadge } from "@/components/StatusBadge";
import { Waveform } from "@/components/Waveform";

const HERO_MOCK_LINES: ReadonlyArray<readonly [string, string]> = [
  ["1", 'import { useState } from "react"'],
  ["2", ""],
  ["3", "export default function App() {"],
  ["4", "  const [count, setCount] = useState(0)"],
  ["5", "  return ("],
  ["6", '    <div className="card">'],
  ["7", "      <h1>Hello, Nexus 👋</h1>"],
  ["8", "      <button onClick={() => setCount(c=>c+1)}>"],
  ["9", "        Clicked {count}×"],
  ["10", "      </button>"],
  ["11", "    </div>"],
  ["12", "  )"],
  ["13", "}"],
];

/**
 * Mini workspace mockup used in the landing hero.
 * Ports the HeroWorkspaceMock from docs/design/nexus/src/landing.jsx.
 */
export function HeroWorkspaceMock() {
  return (
    <div
      style={{
        width: "100%",
        aspectRatio: "16 / 10",
        borderRadius: 14,
        overflow: "hidden",
        border: "1px solid var(--border-subtle)",
        background: "var(--bg-surface)",
        display: "grid",
        gridTemplateColumns: "34% 1fr",
        boxShadow:
          "0 50px 120px -30px rgba(0,229,255,0.18), 0 30px 80px -20px rgba(176,38,255,0.18), 0 0 0 1px rgba(255,255,255,0.04)",
      }}
    >
      <div style={{ position: "relative", minHeight: 0 }}>
        <AvatarPresence state="speaking" />
        <div style={{ position: "absolute", top: 12, left: 12 }}>
          <StatusBadge state="speaking" />
        </div>
        <div
          style={{
            position: "absolute",
            bottom: 14,
            left: "50%",
            transform: "translateX(-50%)",
          }}
        >
          <GlassPill
            style={{
              display: "inline-flex",
              gap: 6,
              padding: "6px 8px",
              alignItems: "center",
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 999,
                background: "var(--bg-elevated)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-primary)",
              }}
            >
              <IconMic size={11} />
            </div>
            <Waveform bars={8} />
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 999,
                background: "rgba(255, 68, 68, 0.15)",
                color: "var(--danger-soft)",
                border: "1px solid rgba(255, 68, 68, 0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <IconPhone size={10} style={{ transform: "rotate(135deg)" }} />
            </div>
          </GlassPill>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          borderLeft: "1px solid var(--border-subtle)",
        }}
      >
        <div
          style={{
            height: 36,
            display: "flex",
            alignItems: "center",
            padding: "0 12px",
            gap: 18,
            borderBottom: "1px solid var(--border-subtle)",
            fontSize: 11.5,
            color: "var(--text-tertiary)",
            fontFamily: "var(--font-jetbrains-mono), monospace",
          }}
        >
          <span
            style={{
              color: "var(--accent-cyan)",
              borderBottom: "2px solid var(--accent-cyan)",
              paddingBottom: 8,
            }}
          >
            ▶ Preview
          </span>
          <span>&lt;/&gt; Code</span>
          <span>· Insights</span>
          <div style={{ flex: 1 }} />
          <span style={{ opacity: 0.7 }}>● ● ●</span>
        </div>
        <div
          style={{
            flex: 1,
            padding: "14px 0",
            background: "var(--bg-canvas)",
            fontFamily: "var(--font-jetbrains-mono), monospace",
            fontSize: 11,
            lineHeight: "18px",
          }}
        >
          {HERO_MOCK_LINES.map(([n, t], i) => (
            <div
              key={i}
              style={{ display: "flex", gap: 14, padding: "0 12px" }}
            >
              <span
                style={{
                  color: "var(--border-strong)",
                  width: 16,
                  textAlign: "right",
                }}
              >
                {n}
              </span>
              <span
                style={{
                  color: "var(--text-secondary)",
                  whiteSpace: "pre",
                }}
              >
                {t}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
