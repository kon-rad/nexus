"use client";

import { GlassPill } from "./GlassPill";
import { IconMic, IconMicOff, IconPhone } from "./icons";
import type { AvatarState } from "./StatusBadge";
import { Waveform } from "./Waveform";

type AvatarControlsProps = {
  muted: boolean;
  onToggleMute: () => void;
  onEnd: () => void;
  state: AvatarState;
  /**
   * Phase 3: live mic track (from `Room.localParticipant`). When provided,
   * the waveform reads true levels via Web Audio. When null, mock animation.
   */
  micTrack?: MediaStreamTrack | null;
};

export function AvatarControls({
  muted,
  onToggleMute,
  onEnd,
  state,
  micTrack = null,
}: AvatarControlsProps) {
  return (
    <GlassPill
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "8px 8px",
      }}
    >
      <button
        type="button"
        className="btn-icon"
        onClick={onToggleMute}
        title={muted ? "Unmute" : "Mute"}
        style={{
          width: 36,
          height: 36,
          borderRadius: 999,
          color: muted ? "var(--text-danger)" : "var(--text-primary)",
        }}
      >
        {muted ? <IconMicOff size={16} /> : <IconMic size={16} />}
      </button>
      <div
        style={{
          padding: "0 12px",
          display: "flex",
          alignItems: "center",
          borderLeft: "1px solid var(--border-subtle)",
          borderRight: "1px solid var(--border-subtle)",
          height: 24,
          color: "var(--accent-cyan)",
        }}
      >
        <Waveform
          active={!muted && state !== "thinking"}
          source={muted ? null : micTrack}
        />
      </div>
      <button
        type="button"
        className="btn-icon"
        title="End session"
        onClick={onEnd}
        style={{
          width: 36,
          height: 36,
          borderRadius: 999,
          background: "rgba(255, 68, 68, 0.12)",
          color: "var(--danger-soft)",
          border: "1px solid rgba(255, 68, 68, 0.3)",
        }}
      >
        <IconPhone size={15} style={{ transform: "rotate(135deg)" }} />
      </button>
    </GlassPill>
  );
}
