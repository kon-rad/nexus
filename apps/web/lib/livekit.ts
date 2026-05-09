/**
 * Phase 3 — Browser-side LiveKit glue.
 *
 * - fetchToken({ sessionId? }) → POST /api/livekit/token
 * - useLiveKitRoom() React hook: connects, exposes mic, the Tavus video track,
 *   and a normalized avatar state ("idle" | "listening" | "thinking" | "speaking").
 *
 * The server is the only thing that holds LiveKit secrets. The browser only
 * touches the WS URL + a 10-min JWT.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ConnectionState,
  LocalParticipant,
  Participant,
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
  Room,
  RoomEvent,
  Track,
  type RemoteVideoTrack,
} from "livekit-client";

export type AvatarState = "idle" | "listening" | "thinking" | "speaking";

export interface TokenResponse {
  token: string;
  url: string;
  room: string;
  identity: string;
  sessionId: string;
  agentName: string;
}

const ORCH_URL =
  process.env.NEXT_PUBLIC_ORCHESTRATOR_URL ?? "http://localhost:4000";

const TAVUS_PARTICIPANT_NAME = "Tavus-avatar-agent";

export async function fetchLivekitToken(
  args: { sessionId?: string } = {},
): Promise<TokenResponse> {
  const r = await fetch(`${ORCH_URL}/api/livekit/token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(`token mint failed: ${r.status} ${text}`);
  }
  const j = (await r.json()) as TokenResponse;
  if (!j.token || !j.url) throw new Error("token response missing fields");
  return j;
}

export interface UseLiveKitRoomState {
  /** Current connection state. "connected" is the green-light. */
  connectionState: ConnectionState;
  /** Avatar's published video track, attached via attachToVideo(). */
  avatarVideoTrack: RemoteVideoTrack | null;
  /** What the agent is doing right now. Mirrored from Convex via the parent. */
  avatarState: AvatarState;
  /** True when the local mic publication is enabled. */
  micEnabled: boolean;
  /** The user's local mic MediaStreamTrack — feed this to the Web Audio analyser. */
  localMicTrack: MediaStreamTrack | null;
  /** Toggle mic mute. */
  toggleMic: () => Promise<void>;
  /** Disconnect + tear down the room. */
  endCall: () => Promise<void>;
  /** Latest token response (so the parent knows the sessionId). */
  token: TokenResponse | null;
  /** Optional connection error surface. */
  error: Error | null;
}

/**
 * Connects to the LiveKit room when called. The hook is intentionally
 * decoupled from React state shape — it just manages the Room and exposes
 * primitives. The avatarState mapping comes from a separate Convex query.
 *
 * Pass `enabled: false` to defer connection (e.g. show a "Start session"
 * button before joining). Default is true: workspace mount = join room.
 */
export function useLiveKitRoom(opts: {
  enabled?: boolean;
  sessionId?: string;
  externalAvatarState?: AvatarState;
}): UseLiveKitRoomState & { sessionId: string | null } {
  const { enabled = true, sessionId: hintedSessionId, externalAvatarState } = opts;

  const roomRef = useRef<Room | null>(null);
  const [token, setToken] = useState<TokenResponse | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    ConnectionState.Disconnected,
  );
  const [avatarVideoTrack, setAvatarVideoTrack] = useState<RemoteVideoTrack | null>(null);
  const [micEnabled, setMicEnabled] = useState(true);
  const [localMicTrack, setLocalMicTrack] = useState<MediaStreamTrack | null>(null);
  const [error, setError] = useState<Error | null>(null);

  // Internal "is the agent currently speaking?" inferred from track audio
  // activity. We use this only when externalAvatarState is undefined (e.g.
  // before Convex catches up).
  const [inferredSpeaking, setInferredSpeaking] = useState(false);

  // Phase 4.4: track the sessionId pushed by the LiveKit agent's
  // start_build / modify_build tool. The agent writes
  // `{ sessionId }` onto its local participant's attributes, which surface
  // in the room as a participant-attributes-changed event.
  const [agentSessionId, setAgentSessionId] = useState<string | null>(null);

  // ---- Lifecycle: connect on mount, disconnect on unmount ----
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    (async () => {
      try {
        const tok = await fetchLivekitToken({ sessionId: hintedSessionId });
        if (cancelled) return;
        setToken(tok);

        const room = new Room({
          adaptiveStream: true,
          dynacast: true,
        });
        roomRef.current = room;

        room.on(RoomEvent.ConnectionStateChanged, (s) => {
          setConnectionState(s);
        });

        room.on(RoomEvent.TrackSubscribed, (
          track: RemoteTrack,
          _pub: RemoteTrackPublication,
          participant: RemoteParticipant,
        ) => {
          // Only attach the avatar's video track. Audio is published by the
          // same participant — autoPlayAudio handles routing it to <audio>.
          if (
            track.kind === Track.Kind.Video &&
            isAvatarParticipant(participant)
          ) {
            setAvatarVideoTrack(track as RemoteVideoTrack);
          }
          if (track.kind === Track.Kind.Audio && isAvatarParticipant(participant)) {
            // Audio element auto-attached via track.attach() in the consumer.
          }
        });

        room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, _pub, participant) => {
          if (track.kind === Track.Kind.Video && isAvatarParticipant(participant)) {
            setAvatarVideoTrack(null);
          }
        });

        room.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
          const avatarSpeaking = speakers.some(isAvatarParticipant);
          setInferredSpeaking(avatarSpeaking);
        });

        room.on(RoomEvent.LocalTrackPublished, (pub) => {
          if (pub.source === Track.Source.Microphone && pub.track) {
            const ms = pub.track.mediaStreamTrack;
            setLocalMicTrack(ms);
          }
        });

        room.on(RoomEvent.LocalTrackUnpublished, (pub) => {
          if (pub.source === Track.Source.Microphone) {
            setLocalMicTrack(null);
          }
        });

        room.on(RoomEvent.Disconnected, () => {
          setAvatarVideoTrack(null);
          setLocalMicTrack(null);
        });

        // Phase 4.4: the LiveKit agent writes the resolved sessionId onto its
        // local-participant attributes when start_build / modify_build returns.
        // From the browser's perspective that participant is *remote*, and its
        // attribute updates surface as ParticipantAttributesChanged events on
        // the room. We also walk existing participants on connect for the
        // case where the agent set the attribute before we subscribed.
        const readAgentAttrs = (p: Participant) => {
          if (isAvatarParticipant(p)) return; // Tavus participant — never carries sessionId
          const sid = p.attributes?.["sessionId"];
          if (typeof sid === "string" && sid) {
            setAgentSessionId((prev) => (prev === sid ? prev : sid));
          }
        };

        room.on(RoomEvent.ParticipantAttributesChanged, (_changed, p) => {
          readAgentAttrs(p);
        });
        room.on(RoomEvent.ParticipantConnected, (p) => {
          readAgentAttrs(p);
        });

        await room.connect(tok.url, tok.token);

        // Publish the user's mic so the agent can hear them.
        await room.localParticipant.setMicrophoneEnabled(true);
        const micPub = getMicPublication(room.localParticipant);
        if (micPub?.track) {
          setLocalMicTrack(micPub.track.mediaStreamTrack);
        }
        setMicEnabled(true);

        // Walk the participants the agent may have already populated before
        // our event listener was attached.
        for (const p of room.remoteParticipants.values()) {
          readAgentAttrs(p);
        }
      } catch (e) {
        if (cancelled) return;
        setError(e as Error);
        // eslint-disable-next-line no-console
        console.error("[livekit] connect failed:", e);
      }
    })();

    return () => {
      cancelled = true;
      const r = roomRef.current;
      roomRef.current = null;
      if (r) void r.disconnect();
    };
  }, [enabled, hintedSessionId]);

  const toggleMic = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !micEnabled;
    await room.localParticipant.setMicrophoneEnabled(next);
    setMicEnabled(next);
    if (!next) {
      setLocalMicTrack(null);
    } else {
      const pub = getMicPublication(room.localParticipant);
      setLocalMicTrack(pub?.track?.mediaStreamTrack ?? null);
    }
  }, [micEnabled]);

  const endCall = useCallback(async () => {
    const r = roomRef.current;
    roomRef.current = null;
    if (r) await r.disconnect();
    setAvatarVideoTrack(null);
    setLocalMicTrack(null);
    setConnectionState(ConnectionState.Disconnected);
  }, []);

  // Derive the avatar state. Convex (externalAvatarState) wins when present;
  // otherwise we fall back to "speaking when the avatar is in the active
  // speakers list" so the UI feels alive even before Convex catches up.
  const avatarState: AvatarState = externalAvatarState
    ?? (connectionState !== ConnectionState.Connected
      ? "idle"
      : inferredSpeaking
      ? "speaking"
      : "listening");

  // The agent-published sessionId wins once it lands. Until then we use the
  // token-mint sessionId (from /api/livekit/token's ensureVoiceSession). This
  // way the right-panel queries always have *some* session to subscribe to,
  // and they swap to the build session the moment start_build returns.
  const sessionId = agentSessionId ?? token?.sessionId ?? null;

  return {
    connectionState,
    avatarVideoTrack,
    avatarState,
    micEnabled,
    localMicTrack,
    toggleMic,
    endCall,
    token,
    error,
    sessionId,
  };
}

function isAvatarParticipant(p: Participant): boolean {
  // Tavus's plugin uses identity = "Tavus-avatar-agent" by default. We
  // double-check on identity *and* the participant's name in case the
  // attribute is unset.
  return (
    p.identity === TAVUS_PARTICIPANT_NAME ||
    p.name === TAVUS_PARTICIPANT_NAME ||
    p.identity.startsWith("Tavus-")
  );
}

function getMicPublication(p: LocalParticipant) {
  for (const pub of p.trackPublications.values()) {
    if (pub.source === Track.Source.Microphone) return pub;
  }
  return undefined;
}
