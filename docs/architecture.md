# Nexus: Real-Time AI Pair Programmer Architecture

> **Objective:** A one-page technical blueprint for Nexus, an AI companion featuring a live video avatar that generates, executes, and previews code projects in real time. Designed specifically to stack the $2,500 Gemini Voice Agent prize, the Cursor SDK prize, the Convex prize, and the Overall Hackathon prize.

![Nexus System Architecture](https://private-us-east-1.manuscdn.com/sessionFile/FQ7Gkqs9oqH1NYdNsyDit8/sandbox/JjxhpELCh8EGt30wadHdMb-images_1778303250365_na1fn_L2hvbWUvdWJ1bnR1L25leHVzX2ZpbmFsX2RpYWdyYW0.png?Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvRlE3R2txczlvcUgxTllkTnN5RGl0OC9zYW5kYm94L0pqeGhwRUxDaDhFR3QzMHdhZEhkTWItaW1hZ2VzXzE3NzgzMDMyNTAzNjVfbmExZm5fTDJodmJXVXZkV0oxYm5SMUwyNWxlSFZ6WDJacGJtRnNYMlJwWVdkeVlXMC5wbmciLCJDb25kaXRpb24iOnsiRGF0ZUxlc3NUaGFuIjp7IkFXUzpFcG9jaFRpbWUiOjE3OTg3NjE2MDB9fX1dfQ__&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=SWlf-d8b2UpAYTqFl6FbGA5Cwyq5zIV~83ClNQZd7L8bThK9fC611Uit9v32TquecBKzsFQCNe4sRSmdZC401iXV6Wkz~P2I4FuN7OQ7L6avrRWRJVLrVoTPmJQfsOF9uNtrhRRJJ7cy8p3wX0sAkBA3bQ7I1sx6jRDkxqaga7Gh9LzsshQue3IJ-FCkl-~D0DPW0ROITUn8vYO0YQvfWwn-LZsWPrfbEb9x8EuonYEtXaH2QKBuGbrJx38aBpA8Rj3UoT5094z-tDYxP-OAXaps052DMzp~LTXzAuVNki8rS0QeAToh3OcM8SUyp7wZJRFeGkTOkm7yAFM-wKeawQ__)

---

## The Technology Stack

### 1. Voice Brain: Gemini 3.1 Flash Live
The core intelligence engine. Gemini 3.1 Flash Live processes continuous audio streams natively, providing sub-500ms latency for bidirectional, interruptible conversations. It detects the user's intent (e.g., "Build a React to-do app") and routes the technical prompt to the Cursor SDK while simultaneously generating the conversational audio response [1].
* **Prize Target:** $2,500 Gemini Voice Agent track.

### 2. Avatar Engine: Tavus Phoenix-4
The visual layer that brings the AI to life. The Tavus Phoenix-4 engine renders the avatar in 1080p at 40 FPS. It features "active listening" (the avatar reacts visually while the user speaks) and micro-expressions across 10+ emotions. By using Tavus's "Bring Your Own LLM" (BYO) mode, Gemini Live's audio is fed directly into the Tavus rendering pipeline [2].
* **Prize Target:** Overall Hackathon Wow Factor.

### 3. Orchestration: LiveKit Agents
The glue that holds the real-time media together. LiveKit handles the complex WebRTC plumbing, routing the user's audio to Gemini Live, and routing Gemini's audio output to the Tavus LiveKit plugin. This eliminates the need to build custom WebSockets or manage Voice Activity Detection (VAD) manually [3].

### 4. Code Generation: Cursor SDK
The AI software engineer. The Node.js backend uses the `@cursor/sdk` to spawn an agent (`Agent.create()`) using the `composer-2` model. The agent is pointed at a Daytona sandbox. As the agent writes code, it streams events (`tool_call`, `status`, `assistant_delta`) back to the backend [4].
* **Prize Target:** Cursor SDK Best Use (1-year Ultra).

### 5. Secure Execution: Daytona
The isolated cloud computer. The Daytona SDK spins up a full Node.js or Python sandbox in under 90ms. The Cursor agent uses Daytona's MCP (Model Context Protocol) tools to write files (`fs.uploadFile`), execute commands (`npm install`), and finally generate a signed, embeddable preview URL (`getPreviewUrl`) for the running application [5].
* **Prize Target:** Daytona participant credits.

### 6. Real-Time State: Convex
The nervous system of the UI. As the Cursor SDK streams events and Daytona returns preview URLs, the Node.js backend pushes this data into Convex via a mutation (`pushAgentEvent`). The Next.js frontend uses a Convex React hook (`useQuery`) to subscribe to these events, updating the Generative UI Panel instantly without polling [6].
* **Prize Target:** Convex Best Use ($500 gift cards).

---

## The End-to-End Workflow

1. **User Speaks:** The user talks into their browser. LiveKit streams the audio via WebRTC to the backend.
2. **Intent & Voice:** Gemini 3.1 Flash Live processes the audio. It sends a conversational audio response to the Tavus plugin (which lip-syncs and streams video back to the user) and sends the technical intent to the Cursor SDK.
3. **Sandbox Creation:** Daytona spins up a secure, isolated sandbox environment in <90ms.
4. **Code Generation:** The Cursor SDK agent begins writing code in the Daytona sandbox. It streams its progress (Thinking → Coding → Running) to Convex.
5. **Live Preview:** The frontend Generative UI panel updates in real-time via Convex. Once Daytona executes the code, it returns a signed preview URL, which the UI renders inside an `<iframe>`.
6. **Completion:** The user sees the live app and can continue talking to the avatar to request changes.

---

### References
[1] Google AI Developers. "Gemini Live API overview." *ai.google.dev*. https://ai.google.dev/gemini-api/docs/live-api
[2] Tavus. "Build Face-to-Face AI Video Agents | Tavus CVI." *tavus.io*. https://www.tavus.io/cvi
[3] LiveKit. "Virtual avatar models overview." *docs.livekit.io*. https://docs.livekit.io/agents/models/avatar/
[4] Cursor. "Cursor SDK Documentation." *cursor.com*. https://cursor.com/docs/sdk/typescript
[5] Daytona. "Daytona Documentation." *daytona.io*. https://www.daytona.io/docs/en/getting-started/
[6] Convex. "Convex Documentation." *convex.dev*. https://docs.convex.dev/home
