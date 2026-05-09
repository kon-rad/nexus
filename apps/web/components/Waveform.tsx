"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type WaveformProps = {
  active?: boolean;
  bars?: number;
  /**
   * Optional real audio source (the user's local mic from
   * `Room.localParticipant`). When provided, the waveform reads RMS
   * amplitude bands from a live AnalyserNode and renders true levels.
   * When absent, falls back to the Phase 1 sine animation.
   */
  source?: MediaStreamTrack | null;
};

/**
 * Audio waveform visualizer. Two modes:
 *
 *   - With `source` (Phase 3): MediaStreamAudioSourceNode → AnalyserNode →
 *     `getByteFrequencyData()` → `bars` bands sampled across the spectrum.
 *   - Without (Phase 1 fallback): the sine-wave mock from the original
 *     placeholder.
 */
export function Waveform({ active = true, bars = 14, source = null }: WaveformProps) {
  const haveSource = source !== null && source !== undefined;
  // Mock-mode tick — keeps the bars dancing when no real source is wired.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (haveSource) return;
    if (!active) return;
    const id = setInterval(() => setTick((t) => t + 1), 110);
    return () => clearInterval(id);
  }, [active, haveSource]);

  // Real-mode setup: build a Web Audio analyser tied to `source` and animate
  // off `requestAnimationFrame` for ~60 fps response.
  const [levels, setLevels] = useState<number[]>(() => Array.from({ length: bars }, () => 0.15));
  const rafRef = useRef<number | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!haveSource || !active) {
      setLevels(Array.from({ length: bars }, () => 0.15));
      return;
    }
    const ms = new MediaStream([source!]);
    // AudioContext can be re-created across mounts; iOS/Safari may need a
    // user gesture to resume it, but mic permission satisfies that on most
    // platforms.
    const ctx: AudioContext = new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    ctxRef.current = ctx;
    const src = ctx.createMediaStreamSource(ms);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256; // 128 frequency bins
    src.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);

    const tickLoop = () => {
      analyser.getByteFrequencyData(data);
      const next: number[] = [];
      const stride = Math.max(1, Math.floor(data.length / bars));
      for (let i = 0; i < bars; i++) {
        let sum = 0;
        const start = i * stride;
        const end = Math.min(data.length, start + stride);
        for (let j = start; j < end; j++) {
          // Defensive index — Uint8Array can return undefined under "noUncheckedIndexedAccess".
          sum += data[j] ?? 0;
        }
        const avg = sum / Math.max(1, end - start) / 255; // 0..1
        // Floor + softer ceiling so the bars never collapse to nothing.
        next.push(Math.max(0.12, Math.min(1, avg * 1.6)));
      }
      setLevels(next);
      rafRef.current = requestAnimationFrame(tickLoop);
    };
    rafRef.current = requestAnimationFrame(tickLoop);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      try {
        analyser.disconnect();
        src.disconnect();
      } catch {
        /* ignore */
      }
      void ctx.close().catch(() => undefined);
      ctxRef.current = null;
    };
  }, [haveSource, source, active, bars]);

  // Mock-mode heights — only used when there's no real source.
  const mockHeights = useMemo(() => {
    if (haveSource) return null;
    return Array.from({ length: bars }).map((_, i) => {
      const seed =
        (Math.sin(tick * 0.7 + i * 1.3) +
          Math.cos(tick * 0.4 + i * 0.7)) *
          0.5 +
        0.5;
      const min = active ? 0.2 : 0.15;
      return min + seed * (active ? 0.8 : 0.05);
    });
  }, [tick, bars, active, haveSource]);

  const heights = haveSource ? levels : (mockHeights ?? []);

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
            transition: haveSource ? "height 60ms linear" : "height 110ms ease",
          }}
        />
      ))}
    </div>
  );
}
