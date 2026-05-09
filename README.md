# Nexus

**Real-Time AI Pair Programmer** — An AI companion with a live video avatar that generates, executes, and previews full code projects in real time.

Nexus combines a real-time video avatar the user speaks to, an AI reasoning engine that understands intent, a coding agent that writes and iterates on code, and a secure sandbox that executes and previews the result. The user never leaves the video call — the entire build cycle happens in a generative UI panel beside the avatar.

## How It Works

1. **Speak to the avatar** — describe the app you want to build
2. **Watch it think** — the panel shows reasoning in real time
3. **Watch it code** — files appear live in a Monaco editor with streaming diffs
4. **Watch it run** — install logs and dev server output stream into a terminal view
5. **Use the result** — a live preview iframe loads the running app inside the panel
6. **Iterate by voice** — keep talking to refine, add features, or deploy

## Architecture

| Layer | Technology | Role |
| --- | --- | --- |
| Avatar & Video Call | Tavus CVI (BYO-LLM mode) | Lip-synced real-time avatar |
| Voice & Reasoning | Gemini 3.1 Flash Live API | Speech understanding + intent routing |
| Coding Agent | Cursor SDK (`@cursor/sdk`) | Generates and edits full code projects |
| Secure Execution | Daytona TypeScript SDK | Isolated sandboxes for running generated code |
| Real-Time State Sync | Convex | Streams agent events to the UI |
| Generative UI | Next.js + Vercel AI SDK | Dynamic panel that morphs based on agent state |
| Voice Persona | ElevenLabs | High-quality TTS for avatar speech |
| Deployment | Vercel | Instant deployment of the host app |

## The Cursor SDK + Daytona Loop

The Cursor agent runs against a Daytona sandbox workspace and uses Daytona's MCP server to write files, execute commands, and request live preview URLs.

```
User voice → Gemini Live → Agent.send(prompt)
  → Cursor agent streams events (assistant / thinking / tool_call / status / task)
  → Daytona sandbox writes files, runs `npm install` and `npm run dev`
  → sandbox.getPreviewUrl(3000) returns a signed URL
  → Iframe loads the running app inside the Generative UI panel
```

Every event is pushed through Convex so the UI updates with zero polling.

## Generative UI States

The right panel beside the video call dynamically renders one of five components based on the current agent state:

- **THINKING** — animated skeleton while the model reasons
- **CODING** — Monaco editor with live file diffs
- **RUNNING** — xterm.js streaming stdout from the sandbox
- **PREVIEW** — live iframe with the Daytona signed URL
- **CHAT** — markdown response for questions and explanations

## Status

Hackathon project — AI Engineer Summit 2026.
