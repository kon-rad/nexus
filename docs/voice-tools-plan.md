# Voice Agent Tools — Implementation Plan

> **Companion to `docs/voice-system-prompt.md` and `docs/voice-architecture.md`.** This is the concrete plan to wire the three tools (`start_build`, `modify_build`, `web_search`) referenced by the system prompt, plus the Tavus dashboard setup that has to happen before any of this can connect end-to-end.
>
> Fits inside `docs/build-plan.md` Phase 3 (Tavus + LiveKit standup) and Phase 4 (codegen wiring). Items here **expand** Phase 4.1 — they don't replace it.
>
> **Marking convention** matches `build-plan.md`: `[ ]` not started · `[~]` in progress · `[x]` done and verified.

---

## Goal

Stand up the LiveKit Agent worker so it:

1. Loads the system prompt from `services/livekit-agent/prompts/system_prompt.txt`.
2. Connects Gemini Live as the realtime model.
3. Wraps the session in `tavus.AvatarSession(replica_id, persona_id)` for BYO avatar.
4. Registers three `@function_tool` handlers — `start_build`, `modify_build`, `web_search` — and routes their calls to the right places.
5. Updates Convex `sessions.avatarState` on `agent_state_changed` so the StatusBadge in the workspace UI reflects reality.

By the end of this plan: a user can talk to Nexus, the avatar replies, the user says "build me X" → orchestrator spins up Daytona + Cursor, code streams into the right panel, and the avatar narrates while it works.

---

## Where each tool lives (call paths)

```
start_build(intent)
  └─ LiveKit Agent (@function_tool)
       └─ HTTP POST  →  Orchestrator  /api/session
                          ├─ daytona.createSandbox()
                          ├─ cursor.agents.create()
                          └─ Convex events → frontend useQuery

modify_build(change)
  └─ LiveKit Agent (@function_tool)
       └─ HTTP POST  →  Orchestrator  /api/session/:id/modify
                          └─ cursor.send(change) on the persisted agent handle

web_search(query)
  └─ LiveKit Agent (@function_tool)
       └─ HTTPS  →  Tavily API  (no orchestrator hop)
                       └─ returns top 5 snippets → fed back into Gemini context
```

The orchestrator sees `start_build` and `modify_build`. It does **not** see `web_search` — that round-trips entirely inside the LiveKit Agent process. This keeps the orchestrator's responsibility narrow (it only owns codegen state).

---

## §1 — Doc updates

- [ ] **1.1** Update `docs/voice-architecture.md` § "Tool-call contract (Phase 3 → Phase 4)" to enumerate all three tools, not just `start_build`. Replace the single `@function_tool` snippet with three. Add return-type contracts for each. Note that `web_search` is the only tool that does not hit the orchestrator.
- [ ] **1.2** Update `docs/build-plan.md` Phase 4.1 — change "The agent has one tool: `start_build`" to "three tools: `start_build`, `modify_build`, `web_search`." Add the new sub-tasks 4.1a–4.1c referenced below to the Phase 4 task list.
- [ ] **1.3** Update `docs/build-plan.md` Phase 4.7 — note that multi-turn refinement is now invoked via the `modify_build` tool (not implicit in `start_build` follow-ups).
- [ ] **1.4** Add a short paragraph to `docs/voice-architecture.md` § "Why this topology" explaining that `web_search` is intentionally agent-side, not orchestrator-side, so search latency is bounded by Gemini's tool-call cycle and does not block codegen state writes.

---

## §2 — Orchestrator code (Node.js, `apps/orchestrator/`)

- [ ] **2.1** Confirm `POST /api/session` (Phase 4.3 wiring) accepts `{ intent: string }` and returns `{ sessionId: string }`. This is the `start_build` target. No new code if Phase 2.8 already shipped this.
- [ ] **2.2** Add `POST /api/session/:id/modify` accepting `{ change: string }`. Implementation:
  - Look up the persisted `cursor.Agent` handle for `:id` (extend `apps/orchestrator/src/cursor.ts` with an in-memory `Map<sessionId, Agent>`; on process restart this is lost — out of scope for hackathon).
  - Call `agent.send({ message: change })` (per Cursor SDK docs).
  - Push a Convex event `{ type: "MODIFY", payload: { change }, ts }`.
  - Return `{ ok: true }` to the LiveKit Agent.
- [ ] **2.3** **Do not** add a `web_search` endpoint to the orchestrator. The LiveKit Agent calls Tavily directly.

---

## §3 — LiveKit Agent code (Python, `services/livekit-agent/`)

The `services/livekit-agent/prompts/system_prompt.txt` file already exists. Everything else here is new.

- [ ] **3.1** Scaffold `services/livekit-agent/` as a Python 3.11 package per `build-plan.md` Phase 3.2. Add `pyproject.toml` with deps: `livekit-agents`, `livekit-plugins-google`, `livekit-plugins-tavus`, `httpx`, `python-dotenv`, `tavily-python`.
- [ ] **3.2** Create `services/livekit-agent/agent.py` that:
  - Loads the system prompt from `prompts/system_prompt.txt`.
  - Constructs `AgentSession` with `livekit.plugins.google.beta.realtime.RealtimeModel(instructions=SYSTEM_PROMPT, voice=...)`.
  - Wraps with `tavus.AvatarSession(replica_id=os.getenv("TAVUS_REPLICA_ID"), persona_id=os.getenv("TAVUS_PERSONA_ID"))`.
  - Registers the three `@function_tool` handlers (next three tasks).
  - Subscribes to `agent_state_changed` and POSTs to `/api/session/:id/avatar-state` on the orchestrator.
- [ ] **3.3** Implement `@function_tool start_build(self, context, intent: str) -> str`:
  - HTTP POST to `${ORCHESTRATOR_URL}/api/session` with `{ intent }`.
  - Store the returned `sessionId` in `context.room.metadata` so the frontend can pick it up.
  - Return a short string acknowledgment for the model (e.g. `"build started"`).
- [ ] **3.4** Implement `@function_tool modify_build(self, context, change: str) -> str`:
  - Read `sessionId` from `context.room.metadata`. If missing, return `"no active build to modify — call start_build first"`.
  - HTTP POST to `${ORCHESTRATOR_URL}/api/session/{sessionId}/modify` with `{ change }`.
  - Return `"changes queued"`.
- [ ] **3.5** Implement `@function_tool web_search(self, context, query: str) -> str`:
  - Call Tavily: `tavily_client.search(query, max_results=5, search_depth="basic")`.
  - Format the top 5 results as plain text — title, URL, snippet — joined with newlines. Cap at ~1500 chars to keep Gemini's context lean.
  - Return that string (it goes back to Gemini as the tool result).
- [ ] **3.6** Add `services/livekit-agent/.env.example` with: `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `GOOGLE_API_KEY`, `TAVUS_API_KEY`, `TAVUS_REPLICA_ID`, `TAVUS_PERSONA_ID`, `TAVILY_API_KEY`, `ORCHESTRATOR_URL`. Document each in a comment.
- [ ] **3.7** Add `services/livekit-agent/README.md` with the run command (`python -m agent dev`) and the env vars. One screen, no fluff.

---

## §4 — Tavus dashboard setup (one-time, manual)

This is what the user fills in via the Tavus web UI to produce the `TAVUS_REPLICA_ID` and `TAVUS_PERSONA_ID` referenced in §3.6. **In BYO mode, most of the persona form fields are bypassed at runtime** — the LiveKit plugin sends pre-rendered audio from Gemini Live straight to Tavus's avatar layer, so the persona's LLM/TTS/STT settings never run.

See §6 below for the exact field-by-field walkthrough. The `[ ]` items here are the click-through:

- [ ] **4.1** Create / pick a **Replica** under *Replicas*. Stock replicas like "Daniel - Office" work for the hackathon. Save the `replica_id`.
- [ ] **4.2** Create a new **Persona** under *Personas*:
  - Persona Name: `Nexus`
  - System Prompt: paste the contents of `services/livekit-agent/prompts/system_prompt.txt` verbatim.
  - Replica: pick the one from 4.1.
  - LLM, TTS, STT, Turn Detection: see §6 — these are bypassed; pick defaults.
- [ ] **4.3** Save the persona; copy the `persona_id` from the URL or the API response.
- [ ] **4.4** Drop both IDs into `services/livekit-agent/.env` as `TAVUS_REPLICA_ID` and `TAVUS_PERSONA_ID`.
- [ ] **4.5** Get a Tavus API key from *API Keys*. Save as `TAVUS_API_KEY` in the same `.env`.

---

## §5 — Tavily setup (web_search backing)

- [ ] **5.1** Sign up at tavily.com (free tier: 1000 searches/month — plenty for the hackathon).
- [ ] **5.2** Generate API key. Save as `TAVILY_API_KEY` in `services/livekit-agent/.env`.
- [ ] **5.3** Verify with `curl -X POST https://api.tavily.com/search -H "Content-Type: application/json" -d '{"api_key":"...","query":"latest Next.js version"}'` returns JSON with `results[]`.

If the team prefers Brave Search, Serper, or Google Programmable Search, swap §3.5 and §5 — the contract (query in, top-5 snippets out) is identical.

---

## §6 — Tavus persona form: field-by-field

The user is staring at the form right now. Here's what each field does in **the BYO architecture we already chose** (`voice-architecture.md` Q1).

| Form field | What it does in our architecture | What to set |
| --- | --- | --- |
| **Persona Name** | Display label only. | `Nexus` |
| **Replica** | The avatar's face and voice character. Tavus uses this regardless of mode. | Pick a stock replica or your custom one. "Daniel - Office" is fine. |
| **System Prompt** | In Tavus CVI mode, drives Tavus's LLM. **In BYO mode, mostly bypassed** — but Tavus may still use it for idle behaviors and gaze cues. Paste it anyway so the persona is self-documenting and so the dashboard's "test" preview works. | Paste `services/livekit-agent/prompts/system_prompt.txt` verbatim. |
| **Language Model (LLM)** | In Tavus CVI mode, the model that generates responses. **In BYO mode, ignored** — Gemini Live is wired in via LiveKit Agents and never touches this field. | Leave default (`tavus-gpt-oss`). It satisfies form validation and never runs. |
| **Tools** | Tavus-side tool definitions. **In BYO mode, ignored** — our tools are registered in Python via `@function_tool` decorators on the LiveKit Agent. | Leave empty. |
| **Turn Detection Model** | When Tavus owns audio, decides when the user is done speaking. **In BYO mode, ignored** — Gemini Live does its own native VAD. | Leave default (`Sparrow-1`). |
| **Perception Model** | Lets the avatar "see" the user's webcam (gestures, expressions). Optional. We are not using webcam vision in the hackathon. | Leave default (`Raven-1`); it's harmless if unused. |
| **Visual Tools** | Trigger actions based on visual cues. Not used. | Leave empty. |
| **Audio Tools** | Trigger actions based on audio cues. Not used (we use Gemini's tool calls instead). | Leave empty. |
| **Text-to-Speech (TTS)** | In Tavus CVI mode, the voice synthesis engine. **In BYO mode, ignored** — Gemini Live emits PCM audio directly into the Tavus avatar layer; Tavus does not synthesize. | Leave default (`Tavus Default`). |
| **Pronunciation Dictionary** | TTS tweaks. **In BYO mode, ignored** — we are not using Tavus's TTS. | Skip. |
| **Speech-to-Text (STT)** | In Tavus CVI mode, transcribes user speech. **In BYO mode, ignored** — Gemini Live ingests raw audio. | Leave default (`tavus-auto`). |
| **Hotwords (STT)** | STT bias terms. **In BYO mode, ignored.** | Leave empty. |
| **Knowledge Base** | Retrieval over uploaded docs at conversation time. Tavus runs this in CVI mode. **In BYO mode, ignored** — our retrieval (when we add it) goes through Gemini's context. | Leave empty. |
| **Objectives** | Tavus's conversation flow scaffolding. **In BYO mode, ignored** — Gemini's system prompt governs flow. | Leave empty. |
| **Guardrails** | Safety-layer prompts in Tavus CVI mode. **In BYO mode, ignored.** | Skip. |

### How does it actually use Gemini, then?

**Not through this form.** Gemini Voice AI is wired in entirely on our side, in the LiveKit Agent. Specifically (§3.2 above):

```python
from livekit.agents import AgentSession
from livekit.plugins import google, tavus

session = AgentSession(
    llm=google.beta.realtime.RealtimeModel(
        model="gemini-2.5-flash-native-audio-preview",
        instructions=SYSTEM_PROMPT,
        voice="Puck",  # one of Gemini's prebuilt voice IDs
    ),
)

avatar = tavus.AvatarSession(
    replica_id=os.getenv("TAVUS_REPLICA_ID"),
    persona_id=os.getenv("TAVUS_PERSONA_ID"),
)
await avatar.start(session, room=ctx.room)
await session.start(agent=NexusAgent(), room=ctx.room)
```

The `tavus.AvatarSession` plugin **subscribes** to `session`'s audio output stream and republishes it into the room as synced audio + 1080p video. The persona's LLM/TTS/STT settings on the dashboard are bypassed because the audio coming into Tavus is already-synthesized speech from Gemini.

If you wanted Tavus to use Gemini *directly* (no LiveKit, no BYO), the lever would be the **LLM dropdown**, set to `custom-llm` with an OpenAI-compatible adapter pointing at Gemini. That is a different architecture from our plan — it loses Gemini Live's native audio streaming, drops the Gemini Voice Agent prize qualification, and is not what we picked in `voice-architecture.md`. **Do not do this.**

---

## §7 — Verification

- [ ] **7.1** `python -m agent dev` connects to LiveKit and joins a room without errors. Logs show "Gemini Live connected", "Tavus avatar started".
- [ ] **7.2** From a browser test client, speaking "hello" gets a spoken response from the avatar within 1.5s, lips synced.
- [ ] **7.3** Saying "build me a todo app" calls `start_build`. The orchestrator returns a `sessionId`. Convex `events` table receives a `THINKING` event within 500ms. Frontend Code Inspection tab starts streaming files.
- [ ] **7.4** Saying "make the buttons blue" after 7.3 calls `modify_build`, not `start_build`. Same sandbox; new code streams into the same files.
- [ ] **7.5** Asking "what is the latest version of Next.js?" calls `web_search`, then the avatar answers with a current version. Logs show one Tavily HTTP call, no orchestrator call.
- [ ] **7.6** Asking "what can you build?" gets a short list of concrete examples (todo app, chat client, snake game…), **not** a sales pitch. The model does **not** call `start_build` until the user picks one.
- [ ] **7.7** Interrupting mid-narration: avatar audio cuts within 300ms, Gemini stops streaming, no zombie lip-sync.
- [ ] **7.8** Three "stress turns" pass:
  - Vague: "hmm, maybe a website?" → no tool call, model asks one clarifying question.
  - Mid-build interruption: user says "stop" while files are streaming → audio cuts, Cursor agent continues silently per `questions.md` Q5 plan.
  - Off-topic: "what's the weather?" → model handles gracefully (probably refuses politely or punts), no tool call misfires.

---

## §8 — Out of scope for this plan

- **Avatar narration during long codegen** (`build-plan.md` 4.5 / `questions.md` Q3). This needs a side channel from the orchestrator → LiveKit Agent → Gemini synthetic-message API. Tracked separately.
- **Failure-mode UI** (`build-plan.md` 4.8). Tavus offline → audio-only fallback. Tracked in Phase 4.8.
- **Production Tavus persona** with a custom replica. Phase 5 polish.
- **Web search caching**. If the same query repeats, we re-call Tavily. Fine for hackathon.

---

**Owner:** voice/media pair (per `build-plan.md` Phase 3 owners).
**Estimated effort:** §1 (1h docs), §2 (2h orchestrator), §3 (4h Python agent), §4 (15min Tavus UI), §5 (10min Tavily), §6 reference, §7 (1h verification). **~8 hours of focused work.**
