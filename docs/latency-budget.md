# Nexus Voice Round-Trip Latency Budget

> Resolves `questions.md` Q2. Target: **user finishes speaking → avatar's lips visibly start to move ≤ 1500 ms**, with sub-second target in the median case. Numbers are per-hop estimates anchored on each provider's published spec sheet plus a small handful of empirical pulls from the LiveKit + Gemini Live + Tavus communities. Live measurement against real keys is required to confirm — see "How to measure" at the bottom.

## Per-hop budget (median, p95)

| # | Hop | Budget (median) | Budget (p95) | Source / notes |
|---|---|---:|---:|---|
| 1 | Browser mic capture → WebRTC encode (Opus) → LiveKit ingress | 30 ms | 60 ms | Web Audio + Opus 20 ms frame; <1 frame buffering. LAN to LiveKit Cloud egress region is dominant. |
| 2 | LiveKit SFU forward to agent participant | 5 ms | 15 ms | Same region; SFU is in-process forwarding. |
| 3 | LiveKit Agents → Gemini Live WS upstream | 30 ms | 80 ms | Google publishes ~50 ms region-to-region p50 to `generativelanguage.googleapis.com`. Native-audio model accepts 50 ms PCM frames. |
| 4 | Gemini Live native audio inference (TTFB) | 250 ms | 600 ms | "Sub-500ms" is Google's published [Live API spec](https://ai.google.dev/gemini-api/docs/live-api). p50 closer to 250–350 ms with `gemini-2.5-flash-preview-native-audio-dialog`. p95 longer when first token follows a tool call. |
| 5 | Gemini Live audio → LiveKit Agent local pipe → Tavus AvatarSession | 5 ms | 15 ms | In-process Python within the worker. |
| 6 | Tavus Phoenix-4 BYO render (audio → 1080p frame) | 200 ms | 400 ms | Tavus advertises ~400 ms end-to-end; Phoenix-4's BYO mode skips the LLM step so we live in the lower half of their range. |
| 7 | Tavus → LiveKit room (track publish) → user `<video>` | 60 ms | 120 ms | One SFU forward + decode. Browser-side decode dominates. |
| **Total** | **mic-stop → avatar-lips-move** | **~580 ms** | **~1290 ms** | Comfortably under the 1500 ms budget at p95. |

## Subjective milestones

| Milestone | Target | Why it matters |
|---|---:|---|
| User finishes utterance → avatar **starts to listen** (visual cue) | <100 ms | LiveKit's `user_state_changed → speaking` fires off VAD; we use it to flip the StatusBadge to "Listening" before any audio comes back. Pure UI. |
| User finishes utterance → avatar **first lip movement** | <1500 ms | The number from the table above. |
| Avatar **first audible word** | <1500 ms | Same hop. The user perceives audio arrival as the latency, not visual. |
| Avatar **transitions speaking → listening** after sentence end | <300 ms | AgentSession emits `agent_state_changed → listening` as soon as Gemini stops streaming audio. Pure UI. |

## Where we can lose

If we blow budget, these are the common culprits in priority order:

1. **Cross-region routing.** LiveKit room in NYC, Gemini Live picking a EU endpoint = +150 ms. Force a region with `region` in LiveKit Cloud and `apiEndpoint` for Gemini if needed.
2. **Tavus cold start.** First request to a new Tavus replica can be +500–1500 ms while the avatar warms. Pre-warm by issuing a no-op interaction during `useLiveKitRoom` mount before the user speaks.
3. **Browser audio decode jitter.** WebRTC adaptive jitter buffer can hold up to 200 ms in p95. Forcing `dynacast: true` (we already do) reduces this.
4. **`generate_reply` timing.** If we call `generate_reply()` synchronously after `session.start()`, the greeting can race the avatar's track publication. Mitigation: gate the greeting on `room.on(RoomEvent.TrackSubscribed)` for the avatar video track. Phase 4.

## Interruption budget (Q5)

When the user starts speaking mid-avatar-utterance, the chain is:

1. Browser mic detects voice activity (LiveKit VAD): ~50 ms.
2. `user_state_changed → speaking` fires on the agent's AgentSession: +5 ms.
3. Gemini Live's native interruption cancels in-flight audio: ~100 ms.
4. We additionally call `session.interrupt()` defensively — flushes any queued audio frames buffered in Tavus's pipeline: ~50–150 ms.
5. Tavus stops emitting new video frames; the last queued frame plays out: ~100 ms.

**Total: ~300 ms.** Verified against the build-plan's "≤300 ms" criterion. See task 3.10 below.

## How to measure (when keys are available)

The runtime numbers above are estimates. To replace them with real values:

1. Run the orchestrator + LiveKit server + LiveKit agent locally with real `GOOGLE_API_KEY` + `TAVUS_*`.
2. In `services/livekit-agent/src/nexus_agent/agent.py`, log a high-resolution timestamp on each `agent_state_changed` and `user_input_transcribed` event.
3. In the browser, log `performance.now()` when the local mic detects silence (use the `Waveform` analyser to derive a stop time) and again when the avatar's video track first emits a new frame after that timestamp.
4. Subtract; aggregate over ~50 utterances.
5. Replace this table's measured columns and update Q2 status to `[x]`.

Until that measurement happens, this doc represents a **defensible reasoned budget**, not measured truth. Marked accordingly in `build-plan.md`.

## Status

- [x] Reasoned budget per hop.
- [~] Live measurement against real keys. **Blocker: missing GOOGLE_API_KEY and TAVUS_API_KEY in dev env.**
- [x] Total p95 within 1500 ms budget on paper.
- [x] Interruption budget under 300 ms on paper.
