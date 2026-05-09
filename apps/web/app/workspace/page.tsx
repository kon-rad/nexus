"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { AvatarControls } from "@/components/AvatarControls";
import { AvatarPresence } from "@/components/AvatarPresence";
import {
  IconBulb,
  IconCog,
  IconCode,
  IconDownload,
  IconPlay,
} from "@/components/icons";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { StatusBadge, type AvatarState } from "@/components/StatusBadge";
import { TabBar, type TabItem } from "@/components/TabBar";
import { CodeInspection } from "./CodeInspection";
import { Insights } from "./Insights";
import { LivePreview } from "./LivePreview";

type TabKey = "preview" | "code" | "insights";

const TABS: ReadonlyArray<TabItem<TabKey>> = [
  { key: "preview", label: "Live Preview", icon: <IconPlay size={11} /> },
  { key: "code", label: "Code", icon: <IconCode size={13} /> },
  { key: "insights", label: "Insights", icon: <IconBulb size={13} /> },
];

const MIN_LEFT_PCT = 18;
const MAX_LEFT_PCT = 60;
const DEFAULT_LEFT_PCT = 30;

export default function WorkspacePage() {
  const [activeTab, setActiveTab] = useState<TabKey>("preview");
  const [muted, setMuted] = useState(false);
  const [aiState, setAiState] = useState<AvatarState>("speaking");
  const [leftWidth, setLeftWidth] = useState<number>(DEFAULT_LEFT_PCT);

  // Cycle avatar states for life — placeholder until Phase 3.
  useEffect(() => {
    const cycle: ReadonlyArray<AvatarState> = [
      "speaking",
      "speaking",
      "thinking",
      "listening",
    ];
    let i = 0;
    const id = window.setInterval(() => {
      i = (i + 1) % cycle.length;
      const next = cycle[i];
      if (next) setAiState(next);
    }, 4200);
    return () => window.clearInterval(id);
  }, []);

  // Resize handle.
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);

  const onDragStart = useCallback(() => {
    dragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const w = ((e.clientX - rect.left) / rect.width) * 100;
      setLeftWidth(Math.min(MAX_LEFT_PCT, Math.max(MIN_LEFT_PCT, w)));
    };
    const onUp = () => {
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const containerStyle: CSSProperties = {
    display: "flex",
    height: "100vh",
    background: "var(--bg-canvas)",
    position: "relative",
    overflow: "hidden",
  };

  return (
    <div ref={containerRef} className="page-fade-enter" style={containerStyle}>
      {/* LEFT: Avatar */}
      <div
        style={{
          width: `${leftWidth}%`,
          position: "relative",
          minWidth: 0,
          flexShrink: 0,
        }}
      >
        <AvatarPresence state={aiState} />
        <div style={{ position: "absolute", top: 16, left: 16 }}>
          <StatusBadge state={aiState} />
        </div>
        <div
          style={{
            position: "absolute",
            top: 14,
            right: 16,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 2,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 500 }}>Aiden</div>
          <div
            style={{
              fontSize: 10.5,
              color: "var(--text-tertiary)",
              fontFamily: "var(--font-jetbrains-mono), monospace",
              letterSpacing: "0.04em",
            }}
          >
            phoenix-4 · 32ms
          </div>
        </div>

        {aiState === "speaking" ? (
          <div
            style={{
              position: "absolute",
              left: 24,
              right: 24,
              bottom: 100,
              textAlign: "center",
              color: "rgba(255, 255, 255, 0.85)",
              fontSize: 14,
              lineHeight: 1.5,
              fontWeight: 400,
              textShadow: "0 2px 12px rgba(0, 0, 0, 0.6)",
              maxWidth: 460,
              margin: "0 auto",
            }}
          >
            "I'll wire up the optimistic insert next so adds feel instant — give
            me ten seconds."
          </div>
        ) : null}
        {aiState === "thinking" ? (
          <div
            style={{
              position: "absolute",
              left: "50%",
              bottom: 100,
              transform: "translateX(-50%)",
              color: "var(--accent-purple)",
              fontFamily: "var(--font-jetbrains-mono), monospace",
              fontSize: 12,
              letterSpacing: "0.08em",
              display: "inline-flex",
              gap: 8,
              alignItems: "center",
            }}
          >
            <span>thinking</span>
            <span style={{ animation: "blink 1s steps(1) infinite" }}>...</span>
          </div>
        ) : null}

        <div
          style={{
            position: "absolute",
            bottom: 28,
            left: "50%",
            transform: "translateX(-50%)",
          }}
        >
          <AvatarControls
            muted={muted}
            onToggleMute={() => setMuted((m) => !m)}
            onEnd={() => {
              /* Phase 3: tear down LiveKit room. */
            }}
            state={aiState}
          />
        </div>
      </div>

      {/* RESIZE HANDLE */}
      <div
        role="separator"
        aria-orientation="vertical"
        onMouseDown={onDragStart}
        style={{
          width: 1,
          background: "var(--border-subtle)",
          cursor: "col-resize",
          position: "relative",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: -3,
            top: 0,
            bottom: 0,
            width: 7,
            cursor: "col-resize",
          }}
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: -2,
            top: "50%",
            transform: "translateY(-50%)",
            width: 5,
            height: 36,
            borderRadius: 999,
            background: "var(--border-strong)",
            opacity: 0.6,
          }}
        />
      </div>

      {/* RIGHT */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          background: "var(--bg-surface)",
        }}
      >
        {/* Top nav (right-panel only) */}
        <div
          className="glass"
          style={{
            height: "var(--nav-h)",
            display: "flex",
            alignItems: "center",
            padding: "0 8px 0 0",
            flexShrink: 0,
            borderTop: "none",
            borderRight: "none",
            borderLeft: "none",
          }}
        >
          <TabBar items={TABS} activeKey={activeTab} onChange={setActiveTab} />
          <div style={{ flex: 1 }} />

          <div
            className="mono"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "0 14px",
              fontSize: 11.5,
              color: "var(--text-tertiary)",
              borderRight: "1px solid var(--border-subtle)",
              height: 24,
            }}
          >
            <span
              className="status-dot speaking"
              style={{ width: 5, height: 5 }}
            />
            <span>00:14:32</span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "0 8px",
            }}
          >
            <button
              type="button"
              className="btn-icon"
              title="Export Code (.zip)"
            >
              <IconDownload size={14} />
            </button>
            <button type="button" className="btn-icon" title="Settings">
              <IconCog size={14} />
            </button>
            <Link
              href="/profile"
              style={{
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
              }}
              aria-label="Open profile"
            >
              <ProfileAvatar
                initials="AK"
                size={32}
                ring
                title="Open profile"
                asChild
              />
            </Link>
          </div>
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
          {activeTab === "preview" ? <LivePreview /> : null}
          {activeTab === "code" ? <CodeInspection /> : null}
          {activeTab === "insights" ? <Insights /> : null}
        </div>
      </div>
    </div>
  );
}
