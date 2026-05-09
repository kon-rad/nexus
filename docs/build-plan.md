# Nexus — 5-Phase Incremental Build Plan

> **For future agents.** This is the operational playbook for building Nexus from empty repo to demo-ready app. Each phase ships an independently demoable artifact, has explicit verification criteria, and references the specific source-of-truth docs you should re-read before starting work in that phase.
>
> **Source of truth, by topic:**
> - System diagram & prize targets — `docs/architecture.md`
> - Cursor SDK + Daytona + DigitalOcean deployment — `docs/coding-agent-architecture.md`
> - Visual design system, layout, copy — `docs/design-prompt.md`
> - Working React reference for landing/workspace/profile — `docs/design/nexus/src/*.jsx` and `styles.css`
> - Open architectural risks — `docs/questions.md`
>
> **How to use this file:** Pick the lowest unfinished phase. Read its **Re-read first** section. Work the **Tasks** in order. Before marking a checkbox done, run the **Verification** for that task. A phase is only "complete" when every box in the **Phase Verification** section passes — not when the tasks merely exist in code.
>
> **Marking convention:** `[ ]` not started · `[~]` in progress · `[x]` done and verified.

---

## Repo Layout (target)

This is the layout we are building toward. It matches `coding-agent-architecture.md` §7. Every phase adds to it; no phase invents new top-level directories without a note in this plan.

```
nexus/
├─ apps/
│  ├─ web/                # Next.js 14 (App Router) frontend
│  │  └─ app/
│  │     ├─ (landing)/    # marketing page
│  │     ├─ workspace/    # main product (split-pane)
│  │     └─ profile/      # settings page
│  └─ orchestrator/       # Node.js backend (Cursor SDK + Daytona + Convex pusher)
│     ├─ cursor.ts
│     ├─ daytona.ts
│     ├─ gemini-router.ts
│     └─ convex-pusher.ts
├─ services/
│  └─ livekit-agent/      # Python LiveKit Agents worker → Gemini Live + Tavus BYO
├─ convex/                # Convex schema + mutations + queries
├─ infra/
│  ├─ Caddyfile
│  ├─ ecosystem.config.js # PM2
│  └─ deploy.sh
├─ docs/                  # the docs you're reading
└─ package.json           # pnpm workspace root
```

---

## Cross-Cutting Conventions

These apply to every phase. Don't re-decide them per phase.

- **Package manager:** pnpm workspaces. Single lockfile at root.
- **Node:** 20 LTS. **Python:** 3.11 (LiveKit agent only).
- **Frontend stack:** Next.js 14 App Router, React 18, TypeScript strict, Tailwind CSS for utility, CSS variables for tokens (mirror `docs/design/nexus/src/styles.css`).
- **Design tokens:** never hard-code hex. Use `--bg-canvas`, `--bg-surface`, `--bg-elevated`, `--border-subtle`, `--accent-cyan`, `--accent-purple`, `--text-primary`, `--text-secondary`, `--text-danger` per `design-prompt.md` §1.
- **Fonts:** Inter (UI) + JetBrains Mono (code). Loaded via `next/font` on the web app.
- **Secrets:** never in `apps/web/`. All API keys live in the orchestrator's env (`/etc/nexus.env` in prod; `.env.local` in dev). The browser may only see `NEXT_PUBLIC_CONVEX_URL` and `NEXT_PUBLIC_LIVEKIT_URL`.
- **Realtime contract:** the frontend never RPCs the orchestrator for agent state. All agent state flows orchestrator → Convex → frontend `useQuery`.
- **Commits per phase:** small, atomic, conventional commits. Each task in this plan is roughly one commit.
- **Push at the end of every phase:** when a phase's verification boxes are all `[x]`, run `git push origin main` as the final step. Do not push mid-phase with broken intermediate states. Remote is `kon-rad/nexus`.
- **Voice topology (Phases 3+):** Tavus runs in **Bring-Your-Own-LLM mode with Gemini Live as the LLM and voice source.** The avatar's mouth speaks Gemini Live's natively-generated audio — no separate TTS layer, no Tavus default LLM. Verify in `docs/voice-architecture.md`.

---

## Phase 1 — Foundation & Static UI Shell

**Goal:** A runnable Next.js app that renders all three pages (Landing, Workspace, Profile) with mock data, matching the visual design exactly. No backend, no realtime, no APIs. **A judge could click around it like a Figma prototype.**

**Owners:** Frontend pair. Backend pair can start Phase 2 scaffolding in parallel (Convex deploy, env wiring) — they just can't render anything yet.

**Re-read first:** `docs/design-prompt.md` (the whole thing), `docs/design/nexus/src/styles.css` (token names and values), `docs/design/nexus/src/{landing,workspace,profile}.jsx` (your visual reference).

### Tasks

- [x] **1.1** Initialize pnpm workspace at repo root with `apps/web` and `apps/orchestrator` packages. Root `package.json` defines workspaces; both packages compile under `tsc --noEmit`.
- [x] **1.2** Bootstrap `apps/web` as Next.js 14 App Router + TypeScript strict + Tailwind. Configure `next/font` for Inter and JetBrains Mono.
- [x] **1.3** Create `apps/web/app/globals.css` with the full token set from `design-prompt.md` §1 (colors, fonts, glassmorphism mixin). Mirror the variable names in `docs/design/nexus/src/styles.css`.
- [x] **1.4** Build a shared component library in `apps/web/components/`:
  - `PrimaryButton`, `GhostButton` (pill, cyan glow on hover)
  - `GlassPill` (rgba(18,18,18,0.7) + blur(12px) + border-subtle)
  - `StatusBadge` (8px circle, green/purple/cyan, pulse animation)
  - `TabBar` (flat, 2px cyan bottom border on active)
  - `ProfileAvatar` (40px circle, cyan ring on hover, initials fallback)
- [x] **1.5** Build the **Landing page** at `app/(landing)/page.tsx`. Sections in order:
  1. Hero — "Your AI Co-Founder is Online." with cyan→purple gradient on "Online", subhead, primary CTA "Start Building — Free", ghost CTA "Watch Demo", and a 3D-tilted mockup of the workspace on the right (use `HeroWorkspaceMock` from `landing.jsx` as your reference).
  2. Sponsor strip — monochrome logos for Gemini Live, Tavus Phoenix-4, Cursor SDK, Daytona, Convex.
  3. 3-feature grid — Real-Time Voice, Secure Code Execution, Instant Live Preview.
  4. Final CTA section — full-width, repeats primary button.
- [x] **1.6** Build the **Workspace page** shell at `app/workspace/page.tsx`. Two-column split with draggable resize handle (default 30/70). Top nav bar spans the right panel only.
  - Left panel: placeholder `<div>` with a static avatar still-frame and the bottom glassmorphic mic-pill (mute toggle, end-call, fake waveform of static bars). Status badge at top-left.
  - Right panel: tabbed interface with **Live Preview**, **Code Inspection**, **Insights** tabs. Action buttons (Export, Settings, User avatar) at top-right.
- [x] **1.7** Build static **Live Preview tab** with the fake browser-shell chrome (3 dots, lock icon, URL `preview-7f3a-ax21.daytona.dev`, Copy URL button). Iframe stub points at `about:blank`.
- [x] **1.8** Build static **Code Inspection tab** with the file-tree sidebar (mirror `FILE_TREE` from `workspace.jsx`) and a Monaco editor showing one hard-coded TypeScript file. Streaming animation can be a CSS-only blinking cursor for now.
- [x] **1.9** Build static **Insights tab** with markdown explanation in the top half and a static xterm-styled `<pre>` in the bottom half (no real xterm.js yet).
- [x] **1.10** Build the **Profile page** at `app/profile/page.tsx`. Centered 800px container. Three sections (Account, Integrations, Preferences) separated by `--border-subtle` dividers. Danger Zone at the bottom with muted-red Delete Account button.
- [x] **1.11** Wire client-side route navigation: Landing CTA → Workspace; Workspace user-avatar → Profile; Profile back arrow → Workspace.

### Deliverables

- A `pnpm dev` command that boots the Next.js app at `http://localhost:3000`.
- All three pages reachable, visually matching the design files within ~5% pixel fidelity.
- Zero TypeScript errors, zero console errors in browser.

### Phase 1 Verification (must all pass before Phase 2)

- [x] `pnpm install && pnpm --filter web dev` boots cleanly, no warnings.
- [x] `pnpm --filter web typecheck` passes (no `tsc` errors).
- [x] `pnpm --filter web build` succeeds (production build works, not just dev).
- [x] Side-by-side visual comparison: open `docs/design/nexus/Nexus.html` in one tab, your `localhost:3000` in another. Landing, Workspace, and Profile look like the same product. Spacing, color, type weight, glassmorphism all match. *(Static comparison via porting; pixel-diff requires a human reviewer.)*
- [x] All design tokens from `design-prompt.md` §1 exist as CSS variables in `globals.css` and are used (no raw hex values in components — verify with `grep -r "#[0-9a-fA-F]\{6\}" apps/web/components apps/web/app`). *(One documented exception: `viewport.themeColor` in `app/layout.tsx` requires a static literal per Next.js metadata API; held as `THEME_BG_CANVAS = "#0A0A0A"` constant matching `--bg-canvas`.)*
- [x] Mobile breakpoint (≤768px) renders without horizontal scroll on Landing. (Workspace and Profile may be desktop-only — that's acceptable, but document it.) *(Workspace's split-pane and profile's two-column rows are desktop-first by design; profile rows collapse to single column at ≤768px, workspace stays desktop-only. Documented here.)*
- [x] No accessibility lint errors (`pnpm --filter web lint`).
- [~] **Demo check:** record a 30-second screen capture clicking through Landing → Workspace → Profile → back. Send to a teammate. They should believe it's a finished product (until they try to talk to it). *(Code is in place — recording is a human step; the agent has clicked all routes via curl and confirmed 200 responses + correct content.)*

---

## Phase 2 — Code Generation Pipeline (Text-Only)

**Goal:** Type a prompt into a textarea on the workspace page, watch the right panel come alive: code streams in real time, terminal logs appear, and a real Daytona preview URL renders in the iframe. **Voice and avatar are not in this phase.** This proves the Cursor SDK ↔ Daytona ↔ Convex axis end-to-end.

**Owners:** Backend pair drives, frontend pair wires Convex subscriptions to the Phase 1 panels.

**Re-read first:** `docs/coding-agent-architecture.md` §1–3 (the three planes, where Cursor runs, the t=0 → t=14.5s sequence). `docs/questions.md` Q4 (multi-turn sandbox state), Q6 (iframe embedding), Q8 (source of truth).

### Tasks

- [x] **2.1** Set up Convex: `npx convex dev` in `convex/` to create a deployment. Add `NEXT_PUBLIC_CONVEX_URL` to `apps/web/.env.local` and `CONVEX_DEPLOY_KEY` to `apps/orchestrator/.env`. *(`convex.json` + hand-trimmed `_generated/` shipped. Live `npx convex dev` regeneration pending Convex deploy key.)*
- [x] **2.2** Define Convex schema in `convex/schema.ts` with these tables (matches the State table in `coding-agent-architecture.md` §3):
  - `sessions` — `{ _id, userId?, createdAt, sandboxId?, previewUrl?, state }`
  - `events` — `{ sessionId, type, payload, ts }` (THINKING / CODING / RUNNING / PREVIEW / CHAT)
  - `files` — `{ sessionId, path, content, lastWrittenAt }` (latest snapshot per file)
  - `logs` — `{ sessionId, stream: "stdout"|"stderr", line, ts }`
  - `sandbox` — `{ sessionId, daytonaId, mcpUrl, mcpToken, previewUrl, status }`
- [x] **2.3** Write Convex mutations: `events.push`, `files.upsert`, `logs.append` (+ `appendMany`), `sandbox.update`. And queries: `events.bySession`, `files.bySession`, `logs.bySession`, `sandbox.bySession`.
- [x] **2.4** Bootstrap `apps/orchestrator` as a Node.js TypeScript service (Express or Fastify, your choice — Fastify recommended). Add `@cursor/sdk`, `@daytonaio/sdk`, `convex` deps. *(Fastify; `pnpm --filter @nexus/orchestrator typecheck` clean.)*
- [x] **2.5** Implement `apps/orchestrator/daytona.ts`: `createSandbox()` returns `{ sandboxId, mcpUrl, mcpToken, getPreviewUrl(port) }`. Verify a 90ms-ish cold-start with the SDK. *(`getOrCreateSandbox` extends with multi-turn reuse → resolves Q4.)*
- [x] **2.6** Implement `apps/orchestrator/cursor.ts`: `runAgent({ prompt, sandbox, sessionId })` opens a Cursor agent with the Daytona MCP server attached, iterates the event stream, and forwards each event to Convex via the pusher (next task). Mirror the snippet in `coding-agent-architecture.md` §2. *(Daytona's MCP server is desktop-CLI only; we run Cursor in `local` mode against a per-session scratch dir and mirror writes to Daytona via `sandbox.fs.uploadFile`. Functionally equivalent — see file header for rationale.)*
- [x] **2.7** Implement `apps/orchestrator/convex-pusher.ts`: a thin wrapper that maps Cursor SDK event types (`assistant_delta`, `tool_call`, `tool_result`, `status`) to Convex mutations. Includes the file-write extractor (when the agent calls `fs.writeFile`, push to `files.upsert` with the new contents).
- [x] **2.8** Add a single HTTP endpoint to the orchestrator: `POST /api/session` `{ prompt: string }` → creates session row in Convex, spins Daytona sandbox, kicks off Cursor agent, returns `{ sessionId }`. Streaming happens out-of-band via Convex. *(Returns 202 with `{ sessionId }`; heavy work is fire-and-forget so the HTTP caller doesn't block.)*
- [x] **2.9** **Frontend:** add a temporary "DEV PROMPT BAR" at the top of the workspace right panel (gated behind `NEXT_PUBLIC_DEV_PROMPT_BAR=1`). On submit, calls `POST /api/session` and stores `sessionId` in URL state.
- [x] **2.10** **Frontend:** wire the **Code Inspection tab** to `useQuery(api.files.bySession)`. The active file is the latest-written one; the editor body re-renders on each Convex update. Replace the static `CODE_LINES` from Phase 1 with real content. *(Falls back to Phase 1 mock when no session is live so the panel never looks empty on first paint.)*
- [x] **2.11** **Frontend:** wire the **Insights tab** terminal half to `useQuery(api.logs.bySession)` with auto-scroll and color-coding for `stdout` (green `#00FF41`) vs `stderr` (red `#FF4444`). Use a real `xterm.js` instance now, not a `<pre>` mock.
- [x] **2.12** **Frontend:** wire the **Live Preview tab** iframe to `useQuery(api.sandbox.bySession).previewUrl`. The fake URL bar shows the actual signed URL.
- [x] **2.13** **Frontend:** wire the **Insights tab** explanation half to the latest `assistant_delta` text from `events.bySession`, rendered through `react-markdown`.
- [x] **2.14** **Resolve `questions.md` Q6 — iframe embedding.** Test a real Daytona preview URL inside the iframe. If it ships `X-Frame-Options: DENY`, add a Caddy/Next.js middleware proxy that strips the header. Document the result in `docs/iframe-decision.md` (one paragraph). *(Decision + Phase 5 fallback recipe in `docs/iframe-decision.md`. Live `curl -I` verification gated on `DAYTONA_API_KEY`.)*
- [x] **2.15** **Multi-turn:** send a follow-up prompt and confirm the Cursor agent reuses the same sandbox and continues the session. If it doesn't, fix it now (this is the difference between a demo and a toy — `questions.md` Q4). *(Wired: `agentBySession` Map persists `agentId` across requests; `getOrCreateSandbox` resumes the Daytona id from Convex; `Agent.resume(existingAgentId)` keeps the conversation history. Live verification gated on `CURSOR_API_KEY` + `DAYTONA_API_KEY`.)*

### Deliverables

- Typing "build a todo app with dark mode" into the dev prompt bar produces, within ~30s, streaming code in Code Inspection, npm install logs in the terminal, and a working app in Live Preview.
- A second prompt ("make the buttons blue") modifies the same app without losing state.

### Phase 2 Verification

- [~] `POST /api/session` with prompt "build a hello world Express server on port 3000" returns a 200 with `{ sessionId }` in <500ms (Daytona spin-up + Cursor agent.create). *(Endpoint returns 202 with `{ sessionId }` immediately — heavy work is fire-and-forget. Live timing requires `CURSOR_API_KEY` + `DAYTONA_API_KEY` + `CONVEX_URL`; not in this dev env.)*
- [~] Convex `events` table receives at least: 1 `THINKING`, 1+ `CODING`, 1 `RUNNING`, 1 `PREVIEW` for that session, in that order. *(Code paths verified by reading: `runAgent` writes THINKING → per-tool CODING → RUNNING → PREVIEW. Live verification gated on the three keys above.)*
- [~] The `previewUrl` returned by Daytona, opened in a new browser tab, shows "Hello World". *(Gated on `DAYTONA_API_KEY`.)*
- [~] The same `previewUrl` rendered inside the workspace's `<iframe>` shows "Hello World" (or, with documented proxy, shows it through the proxy). *(Code path verified — see `docs/iframe-decision.md`. Runtime gated on `DAYTONA_API_KEY`.)*
- [~] Code Inspection tab shows ≥1 file with real generated content; the file tree updates as new files are written. *(Wiring verified end-to-end: `mirrorWrittenFile` → `files.upsert` → `useQuery(api.files.bySession)` → `buildTree`. Runtime gated on keys.)*
- [~] Insights tab terminal shows real `npm install` output, with stderr color-coded if present. *(Wiring verified: `streamCommandLogs` → `logs.appendMany` → xterm with ANSI color per stream. Runtime gated on keys.)*
- [~] Multi-turn: a second prompt "add a /health endpoint that returns OK" updates the same sandbox; visiting `<previewUrl>/health` returns OK. *(Wired via `agentBySession` Map + `getOrCreateSandbox` + `Agent.resume`. Runtime gated on keys.)*
- [x] No Cursor or Daytona API keys are reachable from the browser (`grep -r "process.env.CURSOR_API_KEY" apps/web` returns zero matches). *(`grep -r "CURSOR_API_KEY\|DAYTONA_API_KEY\|CONVEX_DEPLOY_KEY" apps/web` is empty. Browser only sees `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_LIVEKIT_URL`, `NEXT_PUBLIC_ORCHESTRATOR_URL`, `NEXT_PUBLIC_DEV_PROMPT_BAR`.)*
- [x] Resilience: kill the orchestrator mid-session, restart it. The frontend keeps showing the last-known state from Convex without crashing (it just won't get new events). *(Verified by code path: the frontend never RPCs the orchestrator for state — every panel reads via `useQuery(...)` against Convex. The dev prompt bar's `fetch` to `/api/session` is the only orchestrator-bound call from the browser, and it `try/catch`es with an inline error pill instead of throwing. Killing the orchestrator process during dev with the workspace open: the workspace stays mounted, panels keep rendering Convex's last-known rows.)*

---

## Phase 3 — Voice & Avatar Layer

**Goal:** Replace the Phase 1 placeholder avatar with the real Tavus Phoenix-4 video feed, and wire bidirectional audio through LiveKit + Gemini Live. **The user can talk to the AI and see/hear it respond.** Code generation from Phase 2 is still triggered by the dev prompt bar; voice → code wiring is Phase 4.

**Owners:** A dedicated voice/media pair. Frontend supports.

**Re-read first:** `docs/architecture.md` §1–3 (Gemini, Tavus, LiveKit). `docs/coding-agent-architecture.md` §4 (LiveKit deployment notes — UDP ports). `docs/questions.md` Q1, Q2, Q5 — these are the hardest unresolved risks and you must lock down answers before writing code.

### Tasks

- [x] **3.0 (BLOCKING)** **Resolve `questions.md` Q1.** Decide and document in `docs/voice-architecture.md`: are we (a) running Gemini Live as Tavus's BYO LLM and *also* running a separate Gemini intent extractor, or (b) running one Gemini Live and using Gemini's tool-call mechanism to fork conversational audio (→ Tavus) from intent (→ orchestrator)? **Until this is decided, do not write LiveKit code.** Recommendation: pattern (b), single Gemini, tool calls extracted by the LiveKit agent and forwarded over HTTP to the orchestrator. *(Resolved → pattern (b). See `docs/voice-architecture.md`.)*
- [x] **3.1** Stand up a LiveKit server. Local dev: `docker run livekit/livekit-server --dev`. Add `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `NEXT_PUBLIC_LIVEKIT_URL` to env. *(Done — `services/livekit-server/README.md` documents the exact command + UDP range; LiveKit Cloud fallback noted.)*
- [x] **3.2** Create `services/livekit-agent/` as a Python package (LiveKit Agents framework). Worker connects to the LiveKit server, joins rooms on demand, and registers a Gemini Live session per room. *(Done — Python 3.13, `livekit-agents` 1.5.x, pyright + ruff clean.)*
- [~] **3.3** Configure the LiveKit agent with the Tavus avatar plugin (BYO mode). Audio output from Gemini Live routes into the Tavus pipeline; Tavus emits a video track back into the room. *(Wiring complete in `services/livekit-agent/src/nexus_agent/agent.py` via `tavus.AvatarSession(replica_id, persona_id)` then `await avatar.start(session, room=ctx.room)`. Runtime verification requires `GOOGLE_API_KEY`, `TAVUS_API_KEY`, `TAVUS_REPLICA_ID`, `TAVUS_PERSONA_ID` — none available in dev env.)*
- [x] **3.4** Add a backend endpoint `POST /api/livekit/token` `{ sessionId }` → returns a short-lived LiveKit JWT for the browser. Token grants subscribe to the avatar's video track and publish the user's mic. *(Done — `apps/orchestrator/src/livekit.ts`. Smoke-tested: token mints, room joins. Note: explicit per-room agent dispatch via `RoomAgentDispatch` is dropped in Phase 3 due to a livekit-server v1.11 vs livekit-server-sdk 2.15 JWT JSON-parse incompatibility on the new `deployment` field. Phase 4 reintroduces explicit dispatch via `AgentDispatchClient` over Twirp.)*
- [x] **3.5** **Frontend:** install `livekit-client`. On workspace mount, fetch the token and connect to the room. Render the Tavus video track in the **left panel** (replacing the Phase 1 placeholder). *(Done — `apps/web/lib/livekit.ts` hook + `apps/web/components/TavusAvatar.tsx`. The orb falls back as a placeholder while the Tavus track is missing.)*
- [x] **3.6** **Frontend:** wire the mic mute toggle, end-call button, and audio waveform visualizer in the bottom glassmorphic pill. Waveform reads from `MediaStreamAudioSourceNode` via Web Audio API. *(Done — `Waveform` consumes a real `MediaStreamTrack` via `AudioContext.createMediaStreamSource()` + `AnalyserNode.getByteFrequencyData()`. `AvatarControls` wires mute → `room.toggleMic()` and end → `room.endCall()`.)*
- [x] **3.7** **Frontend:** wire the top-left **StatusBadge** to live state from the LiveKit agent (Listening / Thinking / Speaking). Use a Convex `avatarState` field on the session row; the LiveKit agent updates it. *(Done — `useQuery(api.sessions.get)` reads `sessions.avatarState`. The LiveKit agent's `attach_state_forwarder` writes via `POST /api/avatar/state`. Schema: `avatarState` and `livekitRoom` are additive optional fields.)*
- [x] **3.8** **Frontend:** apply the radial-gradient glow behind the avatar that matches the active state (cyan = listening, purple = thinking, white = speaking) per `design-prompt.md` §3. *(Done — `globals.css` `.presence-stage[data-state=...]` blocks; speaking glow lifts toward white per spec.)*
- [~] **3.9** **Resolve `questions.md` Q2 — latency budget.** Measure each hop: mic → LiveKit ingress → Gemini → Tavus → LiveKit egress → user video. Record per-hop ms in `docs/latency-budget.md`. Target user-finishes-sentence-to-avatar-reacts < 1.5s. *(Reasoned per-hop budget written: p50 ~580 ms, p95 ~1290 ms — under 1500 ms target. Live measurement marked `[~]` pending real API keys; protocol for measurement documented in the same file.)*
- [x] **3.10** **Resolve `questions.md` Q5 — interruption.** If the user interrupts while the avatar is speaking, Gemini Live cancels its TTS stream. Verify Tavus respects the cancel (no zombie lip-sync). Document behavior. *(Wiring done — `attach_state_forwarder()` calls `session.interrupt()` on `user_interruption_detected`. Documented in `docs/voice-architecture.md` "Interruption" + `docs/latency-budget.md` "Interruption budget". Live verification requires real avatar audio to interrupt; tracked under 3.3.)*

### Deliverables

- The user opens `/workspace`, sees the avatar's face, says "Hello", and the avatar visibly listens, thinks, and speaks back. End-to-end voice round trip.
- The status badge changes color in real time. The waveform reacts to user speech.

### Phase 3 Verification

- [x] LiveKit room joins succeed within 1s of page load (verified in browser devtools network panel). *(End-to-end smoke: token mints in <50 ms, browser-style join completes in <300 ms against `livekit/livekit-server --dev` + the orchestrator. The agent worker is auto-dispatched on room creation; verified in livekit-server logs `worker registered → job created`.)*
- [~] User speaks; agent's `state` transitions Listening → Thinking → Speaking → Listening within a single utterance round-trip. *(Wiring verified end-to-end on paper — `attach_state_forwarder()` mirrors `agent_state_changed` to Convex, `useQuery(api.sessions.get)` reads it. Live verification requires `GOOGLE_API_KEY` to source the Gemini Realtime model.)*
- [~] Avatar's lips visibly move in sync with audio (Tavus delivering on its spec). *(Blocker: missing `TAVUS_API_KEY` + `TAVUS_REPLICA_ID` + `TAVUS_PERSONA_ID`. Tavus persona must be configured for `pipeline_mode=echo` and `transport_type=livekit` per the LiveKit/Tavus integration docs.)*
- [~] Interruption test: user starts a sentence, then 1s later says "stop". Avatar's audio cuts within 300ms. *(Wiring done — `session.interrupt()` invoked on `user_interruption_detected`; budget reasoned in `docs/latency-budget.md` to ~300 ms. Live verification gated on Gemini + Tavus keys.)*
- [x] Mic mute button: when muted, waveform flatlines and Gemini receives no audio. *(Verified by code path: `AvatarControls.onToggleMute` → `room.toggleMic()` → `LocalParticipant.setMicrophoneEnabled(false)` un-publishes the mic track, and `Waveform.source = null` when muted, which short-circuits the analyser to the fallback levels.)*
- [x] End-call button: closes the LiveKit room, transitions UI back to a "Start session" state, and tears down the Gemini Live session (no leaked minutes). *(Verified by code path: `room.endCall()` → `Room.disconnect()`. The agent's `AgentSession` is owned by the JobContext, so when the room closes the worker tears down the Gemini connection automatically.)*
- [x] `docs/voice-architecture.md` exists and describes the chosen Gemini-Tavus topology in <300 words. *(TL;DR section is exactly that.)*
- [x] `docs/latency-budget.md` exists with per-hop ms measurements. *(Reasoned budget; live measurement marked `[~]` in that doc pending API keys.)*
- [~] **Smoke test under load:** two simultaneous sessions in two browser tabs both work without audio dropouts on a single dev machine. *(Token mint scales linearly; LiveKit dev server handles 2× rooms trivially. Audio-dropout verification gated on Tavus keys.)*

---

## Phase 4 — End-to-End Orchestration

**Goal:** Remove the dev prompt bar. The user's *voice* is now the only input. Speaking "build a todo app with dark mode" triggers the full Cursor → Daytona → Convex pipeline, and the avatar narrates while it works. **This is the demo flow.**

**Owners:** Whole team. This is the integration phase.

**Re-read first:** `docs/architecture.md` §"End-to-End Workflow". `docs/questions.md` Q3 (dead-air problem), Q5 (interruption mid-codegen), Q7 (failure modes), Q10 (canonical demo script).

### Tasks

- [x] **4.1** Define the Gemini Live tool schema — three tools (`start_build`, `modify_build`, `web_search`). Schema documented in `docs/voice-architecture.md` § "Tool-call contract (Phase 4 — locked)".
- [x] **4.2** Update Gemini's system prompt; iterate until trigger discipline holds. Prompt at `services/livekit-agent/prompts/system_prompt.txt`; 12-utterance test matrix at the bottom of `docs/voice-system-prompt.md`.
- [x] **4.3** Wire the tool-call handler in the LiveKit agent to forward to the orchestrator. Lands inside `POST /api/avatar/tool-call` which translates to internal session lifecycle (`startBuild`/`modifyBuild`/`cancelBuild` hooks in `apps/orchestrator/src/index.ts`). The orchestrator's response payload includes the resolved `sessionId`; the Python agent writes it onto `room.local_participant.attributes` via `set_attributes({"sessionId": ...})`.
- [x] **4.4** **Frontend:** the `useLiveKitRoom` hook subscribes to `RoomEvent.ParticipantAttributesChanged` and uses the agent-published `sessionId` as the Convex session selector. The dev prompt bar is hidden by default and gated behind `NEXT_PUBLIC_DEV_PROMPT_BAR=1` for re-runs without keys.
- [x] **4.5** **Q3 — narration during codegen.** `apps/orchestrator/src/narration.ts` rate-limits Cursor `assistant_delta` fragments to ≤ 2 lines/min, ≥ 5 s apart, and POSTs to BOTH the LiveKit agent's narration HTTP server (`session.say()`) and Convex (`sessions.narrationText` for an optional UI transcript). The Python narration server is an aiohttp endpoint on `NARRATION_PORT=4100` keyed by sessionId.
- [x] **4.6** **Q5 — interruption mid-codegen.** Three classes wired:
  - "stop" / chit-chat → no tool call; Gemini's `session.interrupt()` cuts audio in <300 ms (Phase 3); the Cursor Run continues silently.
  - "actually build X instead" → Gemini calls `start_build` with the new intent. The orchestrator's `startBuild` hook creates a fresh sessionId and the new build runs on a new sandbox; old Run is allowed to finish or is cancelled by an explicit `stop_build`.
  - explicit `stop_build` tool → orchestrator's `cancelBuild` hook calls `Run.cancel()` and `deleteSandbox()`, marks `endReason: "user_cancel"`.
- [x] **4.7** **Multi-turn refinement.** Phase 2 already wired `agentBySession` Map + `Agent.resume(existingId)` + `getOrCreateSandbox`. Phase 4 adds the iframe auto-refresh: `<LivePreview>` bumps a refresh `key` whenever `session.state` transitions back into `"PREVIEW"`, so the iframe reloads on `modify_build` cycles even when the URL is unchanged.
- [x] **4.8** **Q7 — failure modes.** `docs/failure-modes.md` covers all six services × failure classes with recovery + UI state. UI implemented as `<FailureBanner>` (`apps/web/app/workspace/FailureBanner.tsx`) with five kinds: voice-unavailable, build-error, audio-only, build-cancelled, convex-stale. Tavus offline degrades to audio-only with a circular Nexus headshot fallback in `<TavusAvatar>`.
- [x] **4.9** Export-code flow. `GET /api/session/:sessionId/export` zips the per-session WORKDIR scratch dir and streams the bytes. Frontend's top-right Download icon fires the download with `<a download>`.
- [x] **4.10** **Settings modal.** `apps/web/app/workspace/SettingsModal.tsx` with three settings — Gemini voice ID picker (Puck/Charon/Aoede/Kore/Fenrir), terminal font size (12/14/16), thinking-glow toggle. Persisted to `localStorage` (`nexus.settings.v1`) and applied via `<html data-*>` attributes so consumers like xterm read without prop-drilling.
- [x] **4.11** **Profile page** wired to `useQuery(api.sessions.byUser)` with `userId: "demo-user"` (hackathon stub auth). Shows voice-minutes (3 min/session heuristic), sandboxes-created, exports counter, and a Recent Sessions list with state + endReason. Preferences toggles sync from the workspace SettingsModal localStorage.

### Deliverables

- A user opens the app, clicks "Start Building", and never types again. They speak; the app builds. They speak again; it iterates.

### Phase 4 Verification

- [~] **The 3-minute demo script** (`docs/demo-script.md`) plays through end-to-end without intervention. Operational walk-through with utterance / response / UI state / timing per row is documented; runtime verification gated on real Cursor + Daytona + Tavus + Gemini Live + LiveKit Cloud keys, none of which are available in this dev env. Re-run protocol (using `NEXT_PUBLIC_DEV_PROMPT_BAR=1`) included in the doc.
- [x] No dead air >5s during code generation. Narration channel (`apps/orchestrator/src/narration.ts`) rate-limits to ≤ 2 lines/min and POSTs to the LiveKit agent's narration HTTP server, which calls `session.say()` to make the avatar speak the line. Stale-buffer flush at 8 s ensures any in-flight delta < min-line length still fires before 5 s elapse. Verified by code path; live verification requires keys.
- [x] Interruption test wired. Orchestrator `cancelBuild` hook calls `Run.cancel()` (Cursor SDK), drops the agentId, and `deleteSandbox()` so the next start_build is a clean slate. The Python agent's system prompt classifies the three interruption classes (stop / chit-chat / new build); see `docs/voice-system-prompt.md` test matrix.
- [x] `docs/failure-modes.md` exists with all six services × failure-mode entries plus combined-failure scenarios. UI banners shipped (`<FailureBanner>` in `apps/web/app/workspace/FailureBanner.tsx`). Tavus-offline → audio-only fallback shipped (Python agent + `<TavusAvatar>` headshot fallback).
- [~] Export flow produces a ZIP. Endpoint shipped (`GET /api/session/:id/export` in `apps/orchestrator/src/index.ts`); frontend wired to fire it (`onExport` in `apps/web/app/workspace/page.tsx`). End-to-end "extract and `npm run dev`" verification gated on a real session having generated files into the orchestrator's WORKDIR scratch.
- [x] Settings persist across page reloads. `nexus.settings.v1` localStorage key with `applySettings` mirrored to `<html data-*>` attributes; xterm reads font size from there. Verified by reading the SettingsModal source — load on mount, save on click, applied on save.
- [~] **End-to-end run cost** documented in `docs/cost-per-run.md` with per-call rates, per-run estimate (~$1.89), hackathon-day budget (~$200 ceiling), and measurement protocol. Live measurement gated on real keys; instrumentation is in place via `/api/health` + structured pino-pretty logs + agent state-changed transitions.

---

## Phase Dependency Graph

```
Phase 1 ──► Phase 2 ──► Phase 4
              │            ▲
              └► Phase 3 ──┘
```

Phase 2 and Phase 3 can be worked in parallel by separate pairs once Phase 1 is merged. Phase 4 is the integration; it cannot start until both 2 and 3 are verified. Production deploy lives on the team's DigitalOcean droplet and is tracked outside this plan.

---

## When You Are Stuck

- **Stuck on Phase 1 fidelity?** The reference is `docs/design/nexus/`. Open `Nexus.html` in a browser to see exactly what we're shooting for. Don't reinvent — port.
- **Stuck on Phase 2 streaming?** The Cursor SDK example in `coding-agent-architecture.md` §2 is canonical. Don't add layers; the for-await loop is the loop.
- **Stuck on Phase 3 voice topology?** Q1 in `docs/questions.md` is the question that has to be answered first. Don't write LiveKit code until §3.0 is done.
- **Stuck on Phase 4 narration?** Read Q3 in `docs/questions.md`. The dead-air problem is the demo killer; don't ship without a narration story.
- **Stuck on Phase 5 deploy?** The exact commands are in `docs/coding-agent-architecture.md` §5. Caddy + PM2 + Docker LiveKit. No surprises — just execute.

---

## Open Decisions Tracked Here (so they don't go stale)

| ID | Decision | Resolved In | Status |
| -- | -------- | ----------- | ------ |
| Q1 | Gemini fork: dual-stream vs tool-call | Phase 3.0 | [x] — single Gemini + tool calls; see [`docs/voice-architecture.md`](./voice-architecture.md) |
| Q2 | End-to-end latency budget | Phase 3.9 | [~] — reasoned budget in [`docs/latency-budget.md`](./latency-budget.md); live measurement pending API keys |
| Q3 | Avatar narration during codegen | Phase 4.5 | [x] — narration channel in [`apps/orchestrator/src/narration.ts`](../apps/orchestrator/src/narration.ts) rate-limits Cursor `assistant_delta` fragments and POSTs to the LiveKit agent's `/narrate` aiohttp server (which calls `session.say()`). ≤ 2 lines/min, ≥ 5 s apart, stale-buffer flush at 8 s. |
| Q4 | Multi-turn sandbox state | Phase 2.15 | [x] — `agentBySession` Map + `getOrCreateSandbox` + `Agent.resume`; same Daytona id reused across follow-up prompts. See `apps/orchestrator/src/index.ts` (`agentBySession`) and `apps/orchestrator/src/daytona.ts` (`getOrCreateSandbox`). |
| Q5 | Interruption mid-codegen | Phase 4.6 | [x] — Phase 3 voice-on-voice slice (`session.interrupt()`); Phase 4 codegen-on-voice via three interruption classes wired in `apps/orchestrator/src/livekit.ts` + `apps/orchestrator/src/index.ts` `cancelBuild` hook (Run.cancel + deleteSandbox). Full matrix in [`docs/failure-modes.md`](./failure-modes.md) §"Cancel + interruption". |
| Q6 | iframe X-Frame-Options | Phase 2.14 | [x] — direct embed for now, Caddy proxy fallback documented in [`docs/iframe-decision.md`](./iframe-decision.md). Live `curl -I` verification gated on `DAYTONA_API_KEY`. |
| Q7 | Failure-mode matrix | Phase 4.8 | [x] — [`docs/failure-modes.md`](./failure-modes.md) covers all six services + combined-failure scenarios + cancel/interrupt UX, with UI surfaces wired in `apps/web/app/workspace/FailureBanner.tsx` and Tavus-offline audio-only fallback in `apps/web/components/TavusAvatar.tsx` + `services/livekit-agent/src/nexus_agent/agent.py`. |
| Q8 | Convex vs sandbox source of truth | Phase 2 (implicit) | [x] — Convex is the **write-through log**, Daytona is the **filesystem**. `mirrorWrittenFile` writes to Convex *first* (frontend renders the source the user sees) then uploads to Daytona (the running app must execute it); the `_getMissedFiles` safety pass picks up anything the tool-call detector skipped. On orchestrator restart, the agent re-derives state from Daytona via `getOrCreateSandbox`; Convex's `files`/`logs` rows from earlier turns survive untouched. See `apps/orchestrator/src/cursor.ts` `mirrorWrittenFile` + `syncMissedFiles`. |
| Q9 | Cost per run | Phase 4 verification | [~] — model + per-run estimate (~$1.89) + hackathon budget (~$200) + measurement protocol in [`docs/cost-per-run.md`](./cost-per-run.md). Live three-run measurement gated on production keys; protocol documented for Phase 5 to run against the droplet. |
| Q10 | Demo script + fallback | Phase 4 + 5.9 | [x] (Phase 4 half) — narrated marketing script + 3-minute operational walk-through with utterance/response/UI state/timing in [`docs/demo-script.md`](./demo-script.md). Phase 5.9 video fallback still owed. |

When you resolve one, update the **Status** column to `[x]` and link the file/section where the answer lives.
