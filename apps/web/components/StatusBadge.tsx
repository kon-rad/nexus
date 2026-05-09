import { GlassPill } from "./GlassPill";

export type AvatarState = "listening" | "thinking" | "speaking";

const LABELS: Record<AvatarState, string> = {
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
};

type StatusBadgeProps = {
  state?: AvatarState;
};

/**
 * 8px colored dot in a glass pill — green/purple/cyan with pulse.
 */
export function StatusBadge({ state = "listening" }: StatusBadgeProps) {
  return (
    <GlassPill
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 12px",
        fontSize: 12,
        fontWeight: 500,
        letterSpacing: "0.01em",
      }}
    >
      <span className={`status-dot ${state}`} />
      <span style={{ color: "var(--text-primary)" }}>{LABELS[state]}</span>
    </GlassPill>
  );
}
