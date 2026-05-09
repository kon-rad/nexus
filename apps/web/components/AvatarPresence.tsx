import type { AvatarState } from "./StatusBadge";

type AvatarPresenceProps = {
  state?: AvatarState;
};

/**
 * Abstract orb placeholder for the Tavus avatar — state-driven glow.
 * Replaced with a live <video> track in Phase 3.
 */
export function AvatarPresence({ state = "speaking" }: AvatarPresenceProps) {
  return (
    <div className="presence-stage" data-state={state}>
      <div className="presence-glow" />
      <div className="presence-orb" />
      <div className="presence-grain" />
      <div
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 10.5,
          letterSpacing: "0.14em",
          color: "rgba(255, 255, 255, 0.55)",
          fontFamily: "var(--font-jetbrains-mono), monospace",
          textTransform: "uppercase",
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            background: "var(--text-danger)",
            boxShadow: "0 0 8px var(--text-danger)",
            animation: "pulse-cyan 1.6s ease-in-out infinite",
          }}
        />
        live
      </div>
    </div>
  );
}
