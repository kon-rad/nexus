"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { AvatarControls } from "@/components/AvatarControls";
import {
  IconBulb,
  IconCog,
  IconCode,
  IconDownload,
  IconPlay,
  IconSparkle,
} from "@/components/icons";
import { SignInPill } from "@/components/SignInPill";
import { StatusBadge } from "@/components/StatusBadge";
import { TabBar, type TabItem } from "@/components/TabBar";
import { TavusAvatar } from "@/components/TavusAvatar";
import { useLiveKitRoom, type AvatarState } from "@/lib/livekit";
import { CodeInspection } from "./CodeInspection";
import { DevPromptBar } from "./DevPromptBar";
import { Insights } from "./Insights";
import { LivePreview } from "./LivePreview";
import { SettingsModal, applySettings, loadSettings } from "./SettingsModal";
import { FailureBanner } from "./FailureBanner";
import { Generate } from "./Generate";

type TabKey = "preview" | "code" | "insights" | "generate";

const DEV_PROMPT_BAR_ENABLED =
  process.env.NEXT_PUBLIC_DEV_PROMPT_BAR === "1";

const TABS: ReadonlyArray<TabItem<TabKey>> = [
  { key: "preview", label: "Live Preview", icon: <IconPlay size={11} /> },
  { key: "code", label: "Code", icon: <IconCode size={13} /> },
  { key: "insights", label: "Insights", icon: <IconBulb size={13} /> },
  { key: "generate", label: "Generate", icon: <IconSparkle size={13} /> },
];

const MIN_LEFT_PCT = 18;
const MAX_LEFT_PCT = 60;
const DEFAULT_LEFT_PCT = 30;

export default function WorkspacePage() {
  const [activeTab, setActiveTab] = useState<TabKey>("preview");
  const [leftWidth, setLeftWidth] = useState<number>(DEFAULT_LEFT_PCT);
  // Phase 2: tracks the active Convex session for the right-panel queries.
  // Phase 4 swaps this for `room.metadata.sessionId` from LiveKit.
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Phase 3: read live avatar state from Convex when a session row exists.
  // The LiveKit agent writes here via the orchestrator's /api/avatar/state.
  const liveSession = useQuery(
    api.sessions.get,
    sessionId ? { sessionId: sessionId as Id<"sessions"> } : "skip",
  );
  const convexAvatarState =
    (liveSession?.avatarState as AvatarState | undefined) ?? undefined;

  // Phase 3: connect to LiveKit on mount. The hook lazily resolves a sessionId
  // from the orchestrator if none is supplied. We mirror it back into our
  // local sessionId state so the right-panel queries pick the same row.
  const room = useLiveKitRoom({
    enabled: true,
    sessionId: sessionId ?? undefined,
    externalAvatarState: convexAvatarState,
  });
  const aiState: AvatarState = room.avatarState;

  useEffect(() => {
    if (room.sessionId && room.sessionId !== sessionId) {
      // Phase 4.4: when the LiveKit agent publishes a new sessionId on
      // local-participant attributes (start_build / modify_build), swap the
      // right-panel queries to the new row so the user sees the live build.
      setSessionId(room.sessionId);
    }
  }, [room.sessionId, sessionId]);

  // Phase 4.4: also pivot when start_build creates a new sessionId. We watch
  // the active tab — if the user is staring at Live Preview when codegen
  // kicks off, switch them to Code so they see files appear.
  useEffect(() => {
    if (!sessionId) return;
    if (liveSession?.state === "THINKING" || liveSession?.state === "CODING") {
      setActiveTab("code");
    } else if (liveSession?.state === "PREVIEW") {
      setActiveTab("preview");
    }
  }, [sessionId, liveSession?.state]);

  // Phase 4.10: settings (avatar voice, terminal font, glow) live in
  // localStorage and are applied to a CSS attribute on <html> so any panel
  // can read them without prop-drilling.
  const [settingsOpen, setSettingsOpen] = useState(false);
  useEffect(() => {
    applySettings(loadSettings());
  }, []);

  // Phase 4.9: Export Code action — fire a download from the orchestrator's
  // /api/session/:id/export endpoint. Disabled until a session has files.
  const orchestratorUrl =
    process.env.NEXT_PUBLIC_ORCHESTRATOR_URL ?? "http://localhost:4000";
  const onExport = useCallback(() => {
    if (!sessionId) return;
    const a = document.createElement("a");
    a.href = `${orchestratorUrl}/api/session/${sessionId}/export`;
    a.download = `nexus-${sessionId}.zip`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [sessionId, orchestratorUrl]);

  // Phase 4.8: derive a failure-mode banner state.
  type BannerKind =
    | "convex-stale"
    | "voice-unavailable"
    | "audio-only"
    | "build-error"
    | "build-cancelled"
    | null;
  const banner: { kind: BannerKind; text: string } | null = (() => {
    if (room.error) {
      return {
        kind: "voice-unavailable",
        text: "Voice unavailable — start the orchestrator + livekit-agent.",
      };
    }
    if (room.connectionState === "connected" && !room.avatarVideoTrack && sessionId) {
      // Connected to LiveKit but no Tavus video — audio-only fallback.
      return {
        kind: "audio-only",
        text: "Tavus avatar offline — running in audio-only mode.",
      };
    }
    if (liveSession?.state === "ERROR") {
      return {
        kind: "build-error",
        text:
          (liveSession?.statusMessage as string | undefined) ??
          "Build failed — try rephrasing your request.",
      };
    }
    if (liveSession?.endReason === "user_cancel") {
      return { kind: "build-cancelled", text: "Build cancelled." };
    }
    if (liveSession === null) {
      // useQuery returned null while we have a sessionId → Convex thinks the
      // row doesn't exist yet. Show a "syncing" banner briefly.
      return { kind: "convex-stale", text: "Syncing build session…" };
    }
    return null;
  })();

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
        <TavusAvatar
          videoTrack={room.avatarVideoTrack}
          state={aiState}
          connecting={!room.avatarVideoTrack && !room.error}
        />
        <div style={{ position: "absolute", top: 16, left: 16, zIndex: 3 }}>
          <StatusBadge state={aiState} />
        </div>
        <div
          style={{
            position: "absolute",
            top: 14,
            right: 16,
            zIndex: 3,
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
            {room.avatarVideoTrack ? "phoenix-4 · live" : "phoenix-4 · idle"}
          </div>
        </div>

        {/* The "thinking" hint surfaces only when the avatar is mid-pause —
            the live face takes care of "speaking" feedback. */}
        {aiState === "thinking" ? (
          <div
            style={{
              position: "absolute",
              left: "50%",
              bottom: 100,
              transform: "translateX(-50%)",
              zIndex: 3,
              color: "var(--accent-purple)",
              fontFamily: "var(--font-jetbrains-mono), monospace",
              fontSize: 12,
              letterSpacing: "0.08em",
              display: "inline-flex",
              gap: 8,
              alignItems: "center",
              textShadow: "0 0 14px rgba(176, 38, 255, 0.6)",
            }}
          >
            <span>thinking</span>
            <span style={{ animation: "blink 1s steps(1) infinite" }}>...</span>
          </div>
        ) : null}
        {room.error ? (
          <div
            style={{
              position: "absolute",
              left: "50%",
              bottom: 100,
              transform: "translateX(-50%)",
              zIndex: 3,
              maxWidth: 360,
              padding: "8px 14px",
              borderRadius: 999,
              background: "rgba(255, 68, 68, 0.12)",
              border: "1px solid rgba(255, 68, 68, 0.3)",
              color: "var(--danger-soft)",
              fontFamily: "var(--font-jetbrains-mono), monospace",
              fontSize: 11,
              letterSpacing: "0.05em",
              textAlign: "center",
            }}
          >
            voice unavailable — start the orchestrator + livekit-agent
          </div>
        ) : null}
        {room.audioBlocked && !room.error ? (
          <button
            type="button"
            onClick={() => void room.resumeAudio()}
            style={{
              position: "absolute",
              left: "50%",
              bottom: 100,
              transform: "translateX(-50%)",
              zIndex: 3,
              padding: "9px 16px",
              borderRadius: 999,
              background: "rgba(0, 232, 255, 0.16)",
              border: "1px solid rgba(0, 232, 255, 0.45)",
              color: "var(--text-primary)",
              fontFamily: "var(--font-jetbrains-mono), monospace",
              fontSize: 11,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            tap to enable audio
          </button>
        ) : null}

        <div
          style={{
            position: "absolute",
            bottom: 28,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 3,
          }}
        >
          <AvatarControls
            muted={!room.micEnabled}
            onToggleMute={() => void room.toggleMic()}
            onEnd={() => void room.endCall()}
            state={aiState}
            micTrack={room.localMicTrack}
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
              onClick={onExport}
              disabled={!sessionId}
              style={{ opacity: sessionId ? 1 : 0.4 }}
            >
              <IconDownload size={14} />
            </button>
            <button
              type="button"
              className="btn-icon"
              title="Settings"
              onClick={() => setSettingsOpen(true)}
            >
              <IconCog size={14} />
            </button>
            {/*
              Auth-aware nav slot. Renders a "Sign in with Google" pill when
              the user is signed out, or the user's avatar + a sign-out menu
              when signed in. Wraps `<Authenticated>` / `<Unauthenticated>`
              from convex/react so the right state shows from first paint.
            */}
            <SignInPill />
          </div>
        </div>

        {/* Phase-2-only dev prompt bar — gated by NEXT_PUBLIC_DEV_PROMPT_BAR. */}
        {DEV_PROMPT_BAR_ENABLED ? (
          <DevPromptBar sessionId={sessionId} onSession={setSessionId} />
        ) : null}

        {/* Phase 4.8 failure / state banner. */}
        {banner ? <FailureBanner kind={banner.kind} text={banner.text} /> : null}

        {/* Tab content */}
        <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
          {activeTab === "preview" ? <LivePreview sessionId={sessionId} /> : null}
          {activeTab === "code" ? <CodeInspection sessionId={sessionId} /> : null}
          {activeTab === "insights" ? <Insights sessionId={sessionId} /> : null}
          {activeTab === "generate" ? <Generate sessionId={sessionId} /> : null}
        </div>
      </div>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
