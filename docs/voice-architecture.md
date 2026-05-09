# Nexus Voice Architecture

> **Resolves `questions.md` Q1 — the Gemini-Tavus topology.** Read this **before** writing any LiveKit, Tavus, or Gemini Live code. This is the contract between Phase 3 (voice + avatar) and Phase 4 (voice → codegen wiring).

---

## TL;DR (≈300 words)

We run **one** Gemini 3.x Live realtime model. Its audio stream is the avatar's voice; its tool-call stream is the orchestrator's command channel. There is no second Gemini instance, and there is no parallel STT-only path.

```
[Browser mic] ── WebRTC ──► LiveKit room ── audio ──► Gemini Live (realtime model)
                                                         │
                                                         ├── audio out ──► Tavus AvatarSession ──► video track ──► LiveKit room ──► [Browser <video>]
                                                         │
                                                         └── tool_call: start_build(intent) ──► LiveKit Agent worker ──► HTTP ──► Orchestrator (Phase 4)
```

The **LiveKit Agent worker** (Python, `services/livekit-agent/`) is the single process that:

1. Joins the LiveKit room as an agent participant.
2. Constructs an `AgentSession` whose `llm` is `livekit.plugins.google.beta.realtime.RealtimeModel` (Gemini Live).
3. Wraps the session in `livekit.plugins.tavus.AvatarSession(replica_id, persona_id)` — Tavus's BYO-LLM mode where the avatar plugin **subscribes to the agent's audio output** and re-publishes synced audio + 1080p video into the room.
4. Registers Python `@function_tool` handlers (e.g. `start_build`). When Gemini emits a tool call, the handler runs **in the agent process** and POSTs to the orchestrator's HTTP endpoint. The Phase 3 build only exposes a no-op `chat_status` tool; the real `start_build` lands in Phase 4.

The **orchestrator** never sees raw audio. It only ever sees HTTP tool-call payloads from the LiveKit Agent and Convex mutations that mirror agent state.

The **browser** never sees Gemini, Tavus, or any API keys. It receives a short-lived LiveKit JWT from the orchestrator, joins the room with `livekit-client`, subscribes to the avatar's video track, and publishes its mic.

## Why this topology (vs the alternatives)

| Option | What it means | Why we rejected it |
|---|---|---|
| **(a) Two Geminis** — one as Tavus BYO, one as STT/intent | Run Gemini Live for voice + a separate Gemini 1.5 Flash STT call to get text for `start_build` | 2× Gemini cost, 2× latency, two sources of truth for what the user said, "did the intent extractor agree with the voice model" debugging hell |
| **(b) Single Gemini + tool calls** *(chosen)* | Gemini Live's native function-calling extracts intent inline; LiveKit Agent forwards tool calls over HTTP | One model, one transcript, native interruption handling. Tool-call latency is "free" — Gemini is already streaming |
| **(c) Cursor/Daytona as MCP server to Gemini** | Skip the orchestrator, hand MCP straight to Gemini Live | Tool-call latency is still bounded by Gemini, but every tool round-trip blocks audio. Also leaks Daytona/Cursor tokens to Gemini's runtime. Hard veto for a hackathon. |

## Audio + video data flow (per-frame)

1. Browser captures mic via `getUserMedia` and publishes an audio track to the room (50 ms Opus frames over WebRTC).
2. LiveKit SFU forwards audio frames to the agent participant.
3. The `AgentSession` pipes audio into Gemini Live's bidirectional WebSocket. Gemini detects voice activity natively (no separate VAD).
4. Gemini emits **two interleaved streams** on the same socket: PCM audio chunks and structured events (text deltas, tool calls, turn boundaries).
5. The PCM audio is consumed by `tavus.AvatarSession`, which forwards it to Tavus Phoenix-4. Tavus generates a lip-synced 1080p/40 fps video and publishes both the **synced audio** and **video** as tracks under a separate participant identity (`Tavus-avatar-agent`).
6. The browser is subscribed to that participant's tracks and renders the video in the workspace's left panel.

The user hears **Tavus's republished audio**, not Gemini's raw audio. This is mandatory — if the browser plays Gemini's audio directly, lips and audio drift.

## Avatar state machine (Phase 3 contract)

The LiveKit Agent listens to `AgentSession`'s `agent_state_changed` event and writes the new state to a Convex `sessions.avatarState` field via an HTTP call to the orchestrator (the orchestrator owns the Convex client; the agent does not).

| `AgentSession.state` | Convex `avatarState` | UI behavior |
|---|---|---|
| `initializing`, `idle` | `idle` | StatusBadge: gray (renders as listening color until first event) |
| `listening` | `listening` | StatusBadge: green pulse, glow: cyan |
| `thinking` | `thinking` | StatusBadge: purple pulse, glow: purple |
| `speaking` | `speaking` | StatusBadge: cyan pulse, glow: cyan/white |

When the user starts speaking while the avatar is mid-sentence, `AgentSession` emits `user_state_changed → speaking` and Gemini Live cancels its in-flight TTS. We additionally call `session.interrupt()` defensively. Tavus respects the upstream audio cut. Verified target: ≤300 ms from "user speaks" → "avatar audio silent" (see `latency-budget.md`).

## Tool-call contract (Phase 3 → Phase 4)

Phase 3 exposes one tool to make sure the wiring works end-to-end without triggering codegen:

```python
@function_tool()
async def chat_status(self, context: RunContext, status: str) -> str:
    """Phase 3 placeholder. The agent calls this to acknowledge it is ready.
    Phase 4 replaces this with start_build(intent: str).
    """
    return f"acknowledged: {status}"
```

The Phase 4 contract (lives in `voice-architecture.md` after Phase 4.1):

```python
@function_tool()
async def start_build(self, context: RunContext, intent: str) -> str:
    """Call when the user describes something to build. Returns sessionId."""
    # POST {intent} → orchestrator /api/session
    # Orchestrator returns { sessionId } and broadcasts via Convex.
    # Agent stores sessionId in room metadata so the frontend reads it.
```

## Token & secret boundaries

| Secret | Lives in | Reaches |
|---|---|---|
| `GOOGLE_API_KEY` (Gemini Live) | LiveKit Agent process env | Gemini Live API |
| `TAVUS_API_KEY` | LiveKit Agent process env | Tavus API |
| `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | Orchestrator process env (token mint) + LiveKit Agent process env (worker auth) | Never to browser |
| `LIVEKIT_URL` | Same as keys | `NEXT_PUBLIC_LIVEKIT_URL` is the **public WebSocket URL only** — fine to expose |
| Browser-issued LiveKit JWT | Browser memory, ~10 min TTL | LiveKit SFU only; scoped to one room and one identity |

## Local dev infra

Local dev runs `livekit/livekit-server --dev` in Docker with UDP 50000–60000 mapped. If Docker is unavailable, fall back to LiveKit Cloud (`wss://<project>.livekit.cloud`). Either way, the env vars are the same — `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` — only the URL changes.

## Interruption (Q5 — Phase 3 scope)

LiveKit Agents 1.5 + Gemini Live handle the wiring for free; we just have to
opt into it. The chain is:

1. Browser publishes mic via WebRTC. LiveKit's built-in VAD detects voice activity.
2. `AgentSession` emits `user_state_changed` with `new_state="speaking"`. We catch
   this in `attach_state_forwarder()` and:
   - Optimistically flip the Convex `avatarState` to `"listening"` (so the UI
     drops out of the speaking glow before any audio confirms it).
   - Call `session.interrupt()` defensively — this propagates a cancel to the
     realtime LLM, which stops emitting audio.
3. Gemini Live's native interruption flushes its TTS buffer. The Tavus
   AvatarSession sees no more audio frames upstream and stops emitting video
   frames after its current playout finishes (target: ≤300 ms — see `latency-budget.md`).
4. Once the user stops speaking and the realtime model picks back up,
   `agent_state_changed` cycles through `listening → thinking → speaking`
   normally.

The Phase 4 codegen variant (interrupt mid-codegen) is out of scope for Phase 3.
Phase 3 only verifies that voice-on-voice interruption holds.

## Things this doc deliberately doesn't cover

- **Cursor / Daytona orchestration.** Phase 2's territory.
- **start_build wiring + dead-air narration.** Phase 4 (Q3, Q5 codegen variant).
- **Failure-mode UI** (Tavus down → audio-only fallback). Phase 4.8 / 5.
- **Production deployment.** Phase 5.

---

**Status:** Q1 resolved. Topology = single Gemini Live + tool calls extracted by LiveKit Agent + Tavus BYO via `tavus.AvatarSession`.
