# Nexus — Hackathon Submission

**The human coding agent.** A video call with a genius developer who builds, runs, researches, and explains software in real time.

## Thesis

The most natural user interface a human ever invented is another human face. We've stared at code editors for fifty years — but we don't think in syntax, we think in conversation. **Code creation is no longer the bottleneck. Understanding is.** Nexus collapses the loop — describe → build → run → explain → refine — into a single voice conversation with a photorealistic avatar.

## What it does

- **Speak to build.** Describe an app and a Cursor SDK agent (composer-2) writes it into a Daytona sandbox booted in under 90 ms. A signed preview URL renders in an iframe inside the right panel — beside the avatar that built it.
- **Speak to refine.** Same sandbox, same conversation history, multi-turn. Interrupt mid-sentence and the avatar stops in under 300 ms.
- **Ask for advice — Exa answers.** When the user asks "should I use X or Y?", the avatar hits Exa's `/answer` endpoint, which returns a synthesized one-paragraph answer with citations pulled live from the web. No training-data drift, current docs, current versions.
- **Ask for an explanation — fal.ai illustrates.** When the user asks "how does this work?", the avatar searches fal.ai's full active-models catalog, picks the right model for the job (text-to-image, text-to-video, audio, 3D — whatever fits), generates the asset, and streams the result into the **Generate** tab in the right panel. The user doesn't just *hear* the answer — they *see* it.

## Sponsor stack

| Layer | Sponsor tech | Role |
| --- | --- | --- |
| Voice + intent | **Gemini 3.1 Flash Live** | Single realtime model. Audio + structured tool calls on one socket. Native interruption. |
| Avatar | **Tavus Phoenix-4** (BYO-LLM) | 1080p, 40 fps lip-synced video. Subscribes to the agent's audio output. |
| Code generation | **Cursor SDK** (`@cursor/sdk`, composer-2) | Writes and edits the user's app inside a sandbox. Cloud-to-cloud over MCP. |
| Sandbox + preview | **Daytona** | Isolated sandbox in <90 ms. Returns a signed preview URL the iframe loads. |
| Reactive state | **Convex** | Every agent event is a mutation; the UI subscribes via `useQuery`. Zero polling. |
| Realtime transport | **LiveKit Agents** | WebRTC plumbing for audio/video. Voice-on-voice interruption ≤300 ms. |
| Web research | **Exa** | `/answer` endpoint — synthesized current-web answers for design + library questions. |
| Any-model generation | **fal.ai** | Dynamic model selection from the active catalog; text-to-image / video / audio / 3D for in-panel concept explanations. |

## Why the architecture is interesting

- **Our server isn't in the data path.** The Cursor agent calls Daytona directly over MCP. Our orchestrator only sees event notifications — Droplet CPU stays flat even when thousands of lines are being generated.
- **One Gemini, two streams.** Audio and tool calls come out of the same socket. We rejected the two-Gemini topology (one for voice, one for STT/intent) — half the cost, half the latency, one source of truth.
- **The avatar is reactive, not pre-baked.** Every UI state — Thinking, Coding, Running, Preview, Generate — is driven by Convex mutations. The right panel morphs in lockstep with what Cursor is doing inside the sandbox.
- **Any AI model, on demand.** Through fal.ai's catalog API, the agent can pick *any* model the user might need to explain a concept — and it does the picking itself, at runtime, based on the question.

## The result

A two-minute conversation produces a deployed application, a researched architectural recommendation, and a generated visual explanation — all inside the same video call. The user never touches a keyboard.
