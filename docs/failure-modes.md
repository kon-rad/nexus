# Nexus Failure-Mode Matrix

> Resolves `questions.md` Q7. Six external services in the critical path. This file maps each one's plausible failure modes to user-visible behavior, recovery path, and the UI state that surfaces it. The UI states are real components shipped in Phase 4 — see the **UI surface** column for the file path.

The contract:

- **A failure should never produce a blank panel or an unhandled exception.** Every state has a banner.
- **Recovery is always at-most-one retry, then graceful apology.** No infinite reconnect loops on stage.
- **The avatar is the user's relationship to the system.** When a service degrades, the avatar acknowledges it in voice, not silently.

## The matrix

| # | Service | Failure mode | What it looks like to us | User-visible behavior | Recovery | UI state | UI surface |
|---|---|---|---|---|---|---|---|
| 1 | **Daytona** | Sandbox spin-up timeout (>10 s) or 5xx | Convex `sandbox.status: "error"`; orchestrator `state: "ERROR"` with `statusMessage: "sandbox timeout"` | Avatar: *"The sandbox is taking longer than usual — let me try once more."* Then if retry fails: *"That's not coming back — try again in a minute."* | Orchestrator retries `daytona.create()` once with 30 s ceiling. If second attempt fails, ends session with `endReason: "daytona_unavailable"`. | `<FailureBanner kind="build-error">` renders the Convex `statusMessage` directly. | `apps/web/app/workspace/FailureBanner.tsx` |
| 2 | **Cursor SDK** | API 5xx mid-stream | `runAgent` for-await loop throws; we classify non-cancel errors and bubble | Avatar: *"That call timed out — let me try again."* User can re-utter or wait. | Cursor's own retries handle transient blips; we don't add extra retry. We DO mark the session ERROR so the UI shows the banner instead of looking frozen. | Same as #1 — `<FailureBanner kind="build-error">` with the Cursor error message. | `apps/web/app/workspace/FailureBanner.tsx` |
| 3 | **Tavus** | API offline / video track never publishes | LiveKit room connects fine, mic publishes, but no `Tavus-avatar-agent` participant ever joins → `avatarVideoTrack === null` after connect | Avatar's voice still works (Gemini Live + LiveKit publish audio directly). Falls back to a circular Nexus headshot in the left panel. Banner reads "Tavus avatar offline — running in audio-only mode." | None — the experience degrades, voice keeps working. Tavus is the wow factor; voice is the floor. | `<FailureBanner kind="audio-only">` + `<TavusAvatar>` orb fallback. The Python agent already catches `avatar.start()` exceptions and proceeds. | `apps/web/app/workspace/page.tsx` derives the kind; `apps/web/components/TavusAvatar.tsx` renders the headshot; `services/livekit-agent/src/nexus_agent/agent.py:entrypoint` swallows the Tavus startup error. |
| 4 | **Gemini Live** | WS drops mid-utterance | `AgentSession` emits `error` → automatic reconnect attempt by the LiveKit Agents framework | If reconnect lands in <3 s the user sees a brief audio gap — the avatar may complete the utterance after a stutter. If >3 s, badge flips to "idle". | LiveKit Agents framework handles reconnect; we surface the gap via avatarState transition. If the worker process dies, `ctx.add_shutdown_callback` runs and the room closes, which the browser sees as `RoomEvent.Disconnected`. | `<FailureBanner kind="voice-unavailable">` if the room itself disconnects. The waveform flatlines; mic mute toggles still work. | `apps/web/lib/livekit.ts` connection state; banner derived in `page.tsx`. |
| 5 | **Convex** | Reactive query disconnects | `useQuery` returns `undefined` (loading) for >5 s, then null/error | Right-panel queries go stale (last-known data is what they show). The orchestrator buffers Cursor events in-process — if Convex is back when the buffer flushes, no data is lost. If Convex stays down, the orchestrator marks `sandbox.status: "stale"` once it reconnects. | Convex client retries automatically. We surface the stale state only if a query result transitions from defined → null. | `<FailureBanner kind="convex-stale">` | `apps/web/app/workspace/page.tsx` |
| 6 | **Orchestrator** | Process crash / restart | Frontend `fetch /api/livekit/token` fails; `fetch /api/avatar/tool-call` indirectly via the Python agent fails (the LiveKit Agent's `OrchestratorClient.tool_call` returns None → tool returns "could not reach the build system") | If the orchestrator is down at workspace mount: `<FailureBanner kind="voice-unavailable">`. If it falls over mid-build: the live Convex query keeps the panel alive with last-known data; the avatar narrates "looks like the build system hiccupped — try once more." | Frontend never re-RPCs the orchestrator for state — that's the whole point of Convex as the source of truth. Avatar voice + LiveKit room survive an orchestrator restart. | Banner shipped; no extra UI needed. | `apps/web/lib/livekit.ts` (catch on token fetch); `services/livekit-agent/src/nexus_agent/orchestrator_client.py` (catch on tool-call) |

## Cancel + interruption (Phase 4.6, Q5)

These are not "failures" — they are the user changing their mind — but they share the failure-banner surface.

| Action | What runs | UI state | Recovery |
|---|---|---|---|
| User says "stop." mid-narration | Gemini cancels TTS via `session.interrupt()`; **no tool call**. The Cursor Run keeps going silently in the background. | None (clean state). | Resume with the next utterance. |
| User says "actually, build X instead." | Gemini calls `start_build("X")`. Orchestrator's `startBuild` hook creates a fresh sessionId, leaves the old Run to complete silently. The frontend swaps panels via the agent's local-participant attribute push. | Briefly `<FailureBanner kind="convex-stale">` while the new sessionId resolves. | Auto-recovers when the new build's first event lands. |
| User clicks End Call | `room.disconnect()` tears down the LiveKit room; orchestrator marks `endReason: "user_end"` if it's listening. | Workspace re-renders to a "Start session" state. | Click Start to mint a new room. |

## Combined-failure scenarios

The matrix above assumes one failure at a time. The real demo failure mode is two-at-once:

| Combined failure | Behavior |
|---|---|
| Tavus offline AND Daytona slow | Audio-only fallback for the avatar + build-error banner once the Daytona retry trips. The orchestrator narrates "still spinning up — sandbox is taking longer than usual" through the Phase 4.5 narration channel so the user knows we're not frozen. |
| Convex disconnect AND Gemini Live drop | Worst-case demo state. The waveform freezes, the panels freeze. The orchestrator's in-process buffer absorbs Cursor events; once Convex returns, panels catch up. **Phase 5.9 fallback video** is the recovery path for stage if both fail at once. |
| Orchestrator down AND user already mid-session | Voice + avatar keep going (LiveKit + Gemini + Tavus don't talk to the orchestrator after handshake). New tool calls fail gracefully ("could not reach the build system"). |

## How we know the matrix is wired

- The four `<FailureBanner>` kinds (voice-unavailable / build-error / audio-only / convex-stale / build-cancelled) are constructed in `apps/web/app/workspace/page.tsx`'s `banner` derivation.
- The Tavus fallback is in `services/livekit-agent/src/nexus_agent/agent.py`'s `entrypoint` (try/except around `avatar.start`).
- The orchestrator's `cancelBuild` hook in `apps/orchestrator/src/index.ts` deletes the Daytona sandbox and resets state, so a "stop then restart" never reuses a half-built sandbox.

## What's deliberately NOT covered here

- **Mic permission denied.** Browser-level. Surfaced by `livekit-client` as a connect error → falls under #4.
- **HTTPS cert expiry.** Phase 5 / Caddy. Out of scope for the dev/demo path.
- **Quota exhaustion** (Tavus minutes, Gemini Live tokens). Tracked in `docs/cost-per-run.md`; the failure looks like #3 or #4 with a 429.
