"use client";

/**
 * Phase 3 — Tavus avatar video player.
 *
 * Replaces the Phase 1 placeholder orb in the workspace's left panel. Renders
 * the Tavus participant's video track and applies a state-driven radial-glow
 * background per docs/design-prompt.md §3:
 *
 *   listening → cyan/green glow
 *   thinking  → purple glow
 *   speaking  → cyan/white glow
 *
 * The component is presentational. The parent owns the room connection and
 * passes the track + state in.
 */

import { useEffect, useRef } from "react";
import Image from "next/image";
import type { RemoteVideoTrack } from "livekit-client";
import type { AvatarState } from "@/lib/livekit";

interface TavusAvatarProps {
  videoTrack: RemoteVideoTrack | null;
  state: AvatarState;
  /** Optional: connection feedback when track hasn't arrived yet. */
  connecting?: boolean;
}

export function TavusAvatar({ videoTrack, state, connecting }: TavusAvatarProps) {
  const videoEl = useRef<HTMLVideoElement | null>(null);

  // Attach + detach the LiveKit track on every change. attach() handles the
  // <video srcObject> wiring and respects autoplay+muted policies.
  useEffect(() => {
    const el = videoEl.current;
    if (!el || !videoTrack) return;
    videoTrack.attach(el);
    return () => {
      try {
        videoTrack.detach(el);
      } catch {
        /* track may already be gone */
      }
    };
  }, [videoTrack]);

  return (
    <div className="presence-stage" data-state={state}>
      {/* Radial glow behind the video — color-matched per state via CSS. */}
      <div className="presence-glow" />
      {videoTrack ? (
        <video
          ref={videoEl}
          // The Tavus plugin publishes audio via the same participant; we
          // intentionally let the element be unmuted so the user hears the
          // avatar's audio (the audio track is auto-attached by livekit-client
          // when the room is constructed with default options).
          autoPlay
          playsInline
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            // Sit above the glow but below overlay UI (status, controls).
            zIndex: 1,
          }}
        />
      ) : (
        // Fallback: show the Nexus headshot in a small framed portrait so the
        // panel never goes empty while Tavus connects.
        <>
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: "min(220px, 40%)",
              aspectRatio: "1 / 1",
              borderRadius: "50%",
              overflow: "hidden",
              border: "1px solid var(--border-subtle)",
              boxShadow:
                "0 0 0 1px rgba(255,255,255,0.04), 0 30px 60px -20px rgba(0,0,0,0.7)",
              zIndex: 1,
            }}
          >
            <Image
              src="/nexus.png"
              alt="Nexus"
              fill
              priority
              sizes="220px"
              style={{ objectFit: "cover", objectPosition: "center 30%" }}
            />
          </div>
          <div className="presence-grain" />
        </>
      )}
      {connecting && !videoTrack ? (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, calc(-50% + 130px))",
            color: "var(--text-tertiary)",
            fontFamily: "var(--font-jetbrains-mono), monospace",
            fontSize: 11,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            zIndex: 2,
          }}
        >
          connecting to nexus…
        </div>
      ) : null}
    </div>
  );
}
