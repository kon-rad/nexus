# Nexus — 2 Minute Demo Script

**Total runtime:** 2:00 · **VO word count:** ~290 · **Format:** [VISUAL] / VO

---

## COLD OPEN — "The thesis" (0:00–0:15)

**[VISUAL]** Hard cut: a blinking cursor on a black editor. Cryptic syntax scrolling fast. Sound of a keyboard. Then — silence. The code dissolves. A human face fades in, looks straight at camera.

**VO:**
> "The most natural interface a human ever invented is another human face. We've stared at code editors for fifty years — but we don't actually think in syntax. We think in conversation."

---

## INTRODUCE NEXUS (0:15–0:30)

**[VISUAL]** Nexus wordmark slides in. Cut to the live product: photorealistic avatar in the left panel, a clean empty workspace on the right. The user (on-camera or just mic) leans in.

**VO:**
> "This is **Nexus** — the human coding agent. It's a video call with a genius developer who writes your code in seconds, advises on architecture, researches the right library, and explains any line back to you. Eye to eye."

---

## LIVE DEMO (0:30–1:20)

**[VISUAL]** User: *"Build me a Pomodoro timer with confetti when the session ends."* Avatar's status badge pulses cyan → purple. Avatar replies in its own voice: *"On it — spinning up your sandbox."*

**[VISUAL]** Right panel cycles: **THINKING** skeleton → **CODING** (Monaco streams `app/page.tsx` line by line) → **RUNNING** (xterm prints `npm install`) → **PREVIEW** (a working Pomodoro app loads in an iframe).

**VO:**
> "Watch the panel. **Ninety milliseconds** in, Daytona has a fresh sandbox. Cursor's composer-2 agent starts writing files — live, streaming, no copy-paste. Fourteen seconds later, my app is running inside an iframe, sitting next to the avatar that built it. I never opened a terminal. I never left the call."

**[VISUAL]** User interrupts mid-sentence: *"Wait — make the timer purple and add a stop button."* Avatar cuts off cleanly, badge flips to listening, then queues changes.

**VO:**
> "And when I cut him off mid-sentence — he stops in under three hundred milliseconds. One Gemini model, one transcript, native interruption. Same sandbox, same conversation, multi-turn refinement."

---

## THE STACK — sponsor tech (1:20–1:45)

**[VISUAL]** Architecture diagram fades in. Components light up as named.

**VO:**
> "Under the hood: **Gemini 3.1 Flash Live** hears my voice and emits two streams on the same socket — audio for the avatar, structured tool calls for the orchestrator. The audio feeds **Tavus Phoenix-4** in BYO-LLM mode — lip-synced 1080p at 40 fps. The tool call hits our Node orchestrator, which spawns a **Cursor SDK** agent. The agent talks to **Daytona** over MCP — directly, cloud to cloud, our server isn't even in the data path. Every event streams through **Convex**; the UI re-renders reactively. No polling. No WebSocket plumbing. **LiveKit Agents** carries it all over WebRTC."

---

## CLOSE — bring the thesis home (1:45–2:00)

**[VISUAL]** Slow push-in on the avatar. User asks softly: *"Hey — explain this useEffect to me."* Avatar smiles, starts talking. Code highlights line by line beside him.

**VO:**
> "Code creation is no longer the bottleneck. **Understanding** is. So we built the most natural interface for understanding — a face. **Nexus.** Software, spoken aloud."

**[VISUAL]** Logo card. Sponsor logos in a tight strip: Gemini · Cursor · Daytona · Convex · Tavus · LiveKit.

---

## Production notes

- **Pacing:** Code-streaming visuals can run faster than realtime — 2× the demo capture is fine. The voiceover sets the rhythm.
- **The wow shots:** (1) sandbox spinning up under a stopwatch overlay, (2) Monaco diff streaming live, (3) the iframe popping in next to the avatar that's still talking, (4) the interruption with a 300 ms timer overlay.
- **Audio:** Capture the avatar's actual Tavus voice for the demo lines — don't dub. The lip sync is the point.
- **Cuttable for 60s:** drop the architecture section and the interruption beat; keep cold open + demo + close.

---

## Operational 3-minute live demo (Phase 4.10)

> The marketing script above is what the camera sees. The block below is what the **operator** runs through with the live system: utterance → expected avatar response → expected sandbox/UI state with timing. Resolves `questions.md` Q10.

### Pre-flight (offstage, ≤30 s)

1. Orchestrator running on `:4000` (`pnpm --filter @nexus/orchestrator dev`).
2. LiveKit dev server running on `:7881` (`docker run livekit/livekit-server --dev`).
3. LiveKit agent running (`cd services/livekit-agent && nexus-agent dev`).
4. Convex deployment URL set in `.env` files.
5. Open `http://localhost:3000/workspace`. Confirm:
   - Avatar's video track loads within ~2 s (orb fallback if Tavus is offline — that's OK on stage; the failure-mode banner reads "audio-only").
   - Status badge shows green "Listening" pulse within 1 s of mic permission grant.

### The 3-minute script

| t | Event | Operator does | Avatar / system response | Visible UI state |
|---|---|---|---|---|
| 0:00 | greet | Walk on. | "Hi — what would you like to build?" | Badge: green Listening pulse. Right panel: Live Preview tab, idle iframe. |
| 0:03 | utt 1 | Say: **"Hi Nexus, build me a todo app with dark mode."** | Badge → purple Thinking → cyan Speaking. Avatar: *"On it — spinning up your sandbox now…"* | Tool call: `start_build("todo app with dark mode")`. Orchestrator returns `{ sessionId }`. Right panel switches to **Code** tab via `room.localParticipant.attributes.sessionId`. |
| 0:08 | sandbox | (no input) | (silence ~3 s) | Insights tab: status row says "Spinning up sandbox…" then "Cursor agent reasoning…". |
| 0:12 | first file | (no input) | Avatar (narration): *"Scaffolding the components now."* | Code Inspection tab: `package.json` appears, then `app/page.tsx` streams in line by line. |
| 0:25 | install | (no input) | Avatar: *"Installing dependencies — give me a sec."* | Insights terminal half: `npm install` stdout streams green. |
| 0:35 | preview | (no input) | Avatar: *"There you go — todo app with dark mode."* | Live Preview tab auto-shows the running app. URL bar: `https://3000-<sandbox>.proxy.daytona.work`. State badge: cyan "Listening". |
| 0:45 | utt 2 | Say: **"Add a confetti animation when I complete a task."** | Avatar: *"On it."* (calls `modify_build`). | Same Convex sessionId. Code Inspection switches to whatever file the agent edits next. |
| 1:15 | preview update | (no input) | Avatar: *"Try it — click a task."* | Iframe auto-refreshes (key change on previewUrl); confetti fires on click. |
| 1:30 | utt 3 — interrupt | Say: **"Stop. Actually, build me a snake game instead."** (cut in mid-narration) | Avatar audio cuts within 300 ms. Then: *"Switching gears — building the snake game now."* | Tool call: agent classifies as new build → `start_build("snake game")`. Orchestrator cancels the old Cursor Run; a fresh sandbox spins up. |
| 2:00 | snake renders | (no input) | Avatar: *"Snake's ready — use arrow keys."* | Live Preview tab shows the snake game. |
| 2:30 | utt 4 — research | Say: **"What's the latest Next.js version?"** | Avatar: *(brief pause)* *"Looks like 15.1 just shipped — want me to upgrade?"* | Tool call: `web_search("latest Next.js version")` → Exa `/answer`. **No** orchestrator call. |
| 2:50 | export | Click **Export Code** in the top-right. | (no audio) | Browser downloads `nexus-<sessionId>.zip`. |
| 3:00 | end | Say: **"Thanks, that's all."** | Avatar: *"Anytime."* | End-call button tears down the room. |

### What "no dead air >5s" means here

Between t=0:08 and t=0:35 the Cursor agent is mid-codegen. The narration channel (Phase 4.5, `apps/orchestrator/src/narration.ts`) rate-limits Cursor's `assistant_delta` fragments to ≤ 2 lines/min and forwards them to the LiveKit agent's `/narrate` endpoint, which calls `session.say()` so the avatar speaks. Combined with the Phase 3 state-changed greeting on tool entry, that gives us ~4 narration beats per build, well under any 5 s gap.

### What to do if a step fails

| Failure | Fallback | Demo recovery |
|---|---|---|
| Tavus video doesn't load | Orb fallback already shipped (`<TavusAvatar>` Phase 3). Failure-banner says "audio-only". | Continue — voice still works. Mention the banner once, smile, move on. |
| Daytona sandbox 4xx | `/api/health` flags `daytonaKey: false` if the key is missing. Live errors surface as Convex `state: "ERROR"` with `statusMessage`. | Switch to the pre-recorded video fallback. |
| Cursor 5xx mid-stream | Run cancels; orchestrator marks state ERROR. Avatar should apologize per system prompt: *"That call timed out — let me try again."* | Re-utter the original `start_build` request. |
| Gemini Live drops | LiveKit agent reconnects automatically; we mirror to Convex `endReason: "reconnect"` if the gap exceeds ~3 s. | Pause for 3 s; the badge will go red. If it doesn't recover in 5 s, switch to fallback video. |

### How to time the demo for the deck

The marketing script (top of file) is meant to play **over** the live operational demo. The operational columns above clock at ~3:00; tighten to 2:00 by skipping utt 3 (interruption demo) and utt 4 (web_search) — both can be teased in the narrator's voiceover instead.

### Re-run protocol (when keys are missing)

To dry-run this script without real Cursor/Daytona/Tavus/Gemini keys:

1. Set `NEXT_PUBLIC_DEV_PROMPT_BAR=1` in `apps/web/.env.local` to surface the Phase 2 dev prompt bar.
2. Type the utterances from the operational table into the dev prompt bar instead of speaking them. The orchestrator routes them through the same `/api/session` path that `start_build` uses.
3. Mock the avatar by stubbing `fetchLivekitToken` to return a 503 — the workspace will fall back to the orb and disable mic. The right-panel timing should still match.
