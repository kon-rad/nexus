# Nexus — Demo Voiceover

> Spoken text only. ~290 words, ~2:00 at a brisk demo pace.

---

The most natural interface a human ever invented is another human face. We've stared at code editors for fifty years — but we don't actually think in syntax. We think in conversation.

This is Nexus — the human coding agent. It's a video call with a genius developer who writes your code in seconds, advises on architecture, researches the right library, and explains any line back to you. Eye to eye.

Watch the panel. Ninety milliseconds in, Daytona has a fresh sandbox. Cursor's composer-2 agent starts writing files — live, streaming, no copy-paste. Fourteen seconds later, my app is running inside an iframe, sitting next to the avatar that built it. I never opened a terminal. I never left the call.

And when I cut him off mid-sentence — he stops in under three hundred milliseconds. One Gemini model, one transcript, native interruption. Same sandbox, same conversation, multi-turn refinement.

Under the hood: Gemini 3.1 Flash Live hears my voice and emits two streams on the same socket — audio for the avatar, structured tool calls for the orchestrator. The audio feeds Tavus Phoenix-4 in BYO-LLM mode — lip-synced 1080p at 40 frames a second. The tool call hits our Node orchestrator, which spawns a Cursor SDK agent. The agent talks to Daytona over MCP — directly, cloud to cloud, our server isn't even in the data path. Every event streams through Convex; the UI re-renders reactively. No polling. No WebSocket plumbing. LiveKit Agents carries it all over WebRTC.

Code creation is no longer the bottleneck. Understanding is. So we built the most natural interface for understanding — a face. Nexus. Software, spoken aloud.
