# Top 10 Open Questions — Nexus Architecture

Ten things we have to answer before this stops being a diagram and starts being a demo. Ordered by how badly each one can kill us if we get it wrong.

## 1. How does Gemini Live actually fork into "talk to Tavus" *and* "send intent to Cursor" simultaneously?

The architecture claims Gemini sends conversational audio to Tavus AND a technical prompt to the Cursor SDK in parallel. But Tavus BYO LLM mode expects to *be* the LLM stream, and Gemini Live emits a single audio stream. Is this a function/tool call from Gemini that the backend intercepts, or are we running Gemini twice (once for voice, once for intent extraction)? The whole architecture pivots on this answer.

## 2. What is the real end-to-end latency budget, hop by hop?

Mic → LiveKit → Gemini Live → (Tavus BYO render → LiveKit → user video) is already 4+ hops before code generation. Sub-500ms is the Gemini Live spec for *audio*, not for the full avatar round trip. We need a measured budget per hop and a target for "user finishes sentence → avatar visibly reacts" — otherwise the wow factor evaporates.

## 3. What happens during the 5–60 seconds while Cursor + Daytona are working?

Sandbox spin-up is 90ms but `npm install` + code generation is *not*. The avatar can't go silent for 30 seconds. Does Gemini narrate ("I'm scaffolding the components now…")? Do we stream Cursor's `assistant_delta` events through Gemini as TTS? Without a story here, the demo has dead air at the worst moment.

## 4. How does multi-turn iteration map to sandbox state?

User says "build a todo app" → sandbox A. User says "make the buttons blue" → does the Cursor agent reuse sandbox A, or do we spin up a new one and lose state? How is the agent's conversation history preserved across turns? This is the difference between a demo and a toy.

## 5. What happens when the user interrupts mid-code-generation?

Gemini Live's killer feature is interruption. But if the user interrupts while Cursor is 40% through writing files in Daytona, do we cancel the agent? Let it finish? Discard the sandbox? The interaction model needs a defined answer or the avatar will feel broken the first time someone changes their mind.

## 6. Will the Daytona preview URL actually render in our iframe?

Signed preview URLs often ship with `X-Frame-Options: DENY`, strict CSP, or HTTPS-only constraints. We need to verify *today* that a Daytona-hosted Next.js app will embed in our Next.js frontend without the iframe going blank. If it won't, we need a proxy or a redirect-out-of-iframe fallback.

## 7. What is the failure-mode matrix?

Six services in the critical path: Gemini, Tavus, LiveKit, Cursor, Daytona, Convex. Any one failing kills the demo. Which failures degrade gracefully (e.g., avatar drops to audio-only) and which are fatal (sandbox creation timeout)? We need a one-page table mapping each failure to user-visible behavior before demo day.

## 8. Who owns the source of truth — Convex or the live sandbox?

Cursor streams events to Convex; Daytona is the actual filesystem. If a Convex mutation lands but the Daytona file write failed, the UI shows code that doesn't exist. What's the reconciliation strategy? Or do we treat Convex as a write-through log and re-derive state from Daytona on reconnect?

## 9. What are the rate limits, quotas, and costs per demo run?

A single 5-minute demo touches: Gemini Live minutes, Tavus avatar minutes (these are *expensive*), Daytona compute, Cursor SDK calls, LiveKit bandwidth, Convex function calls. Do we have headroom for ~50 practice runs + judges + stage demo? Tavus minutes especially — what's the per-run burn?

## 10. What is the canonical 3-minute demo flow, and what's the fallback?

We are stacking 4 prizes, which means the demo must visibly hit Gemini Voice + Cursor SDK + Convex realtime + overall wow inside the time limit. Write the actual script: utterance 1, expected avatar response, expected sandbox output, expected UI update. Then write the fallback: if Daytona is slow / Cursor errors / network drops, what do we show instead of a frozen avatar?
