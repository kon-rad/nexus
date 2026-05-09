"use client";

import { useEffect, useMemo, useState } from "react";

type WaveformProps = {
  active?: boolean;
  bars?: number;
};

/**
 * Pure-CSS audio waveform mock. Animates heights on a tick when active.
 * Replaced with a real Web Audio analyzer in Phase 3.
 */
export function Waveform({ active = true, bars = 14 }: WaveformProps) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setTick((t) => t + 1), 110);
    return () => clearInterval(id);
  }, [active]);

  const heights = useMemo(() => {
    return Array.from({ length: bars }).map((_, i) => {
      const seed =
        (Math.sin(tick * 0.7 + i * 1.3) +
          Math.cos(tick * 0.4 + i * 0.7)) *
          0.5 +
        0.5;
      const min = active ? 0.2 : 0.15;
      return min + seed * (active ? 0.8 : 0.05);
    });
  }, [tick, bars, active]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 3,
        height: 18,
      }}
    >
      {heights.map((h, i) => (
        <div
          key={i}
          style={{
            width: 2,
            height: `${h * 100}%`,
            background: active
              ? "var(--accent-cyan)"
              : "var(--text-tertiary)",
            borderRadius: 1,
            boxShadow: active ? "0 0 6px var(--accent-cyan)" : "none",
            transition: "height 110ms ease",
          }}
        />
      ))}
    </div>
  );
}
