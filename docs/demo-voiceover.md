# Nexus — Demo Voiceover

> Spoken text only. ~370 words, ~2:15 at a brisk demo pace.

---

The most natural interface a human ever invented is another human face. We've stared at code editors for fifty years — but we don't actually think in syntax. We think in conversation.

This is Nexus — the human coding agent. It's a video call with a genius developer who writes your code in seconds, advises on architecture, researches the right library, and explains any line back to you. Eye to eye.

Watch the panel. Ninety milliseconds in, Daytona has a fresh sandbox. Cursor's composer-2 agent starts writing files — live, streaming, no copy-paste. Fourteen seconds later, my app is running inside an iframe, sitting next to the avatar that built it. I never opened a terminal. I never left the call.

And when I cut him off mid-sentence — he stops in under three hundred milliseconds. One Gemini model, one transcript, native interruption. Same sandbox, same conversation, multi-turn refinement.

Ask for advice — Exa searches the live web and gives the avatar a single synthesized answer. Current docs, current versions, no training-data drift. Ask it to explain a concept — the avatar searches fal.ai's catalog, picks the right model for the job — image, video, audio, 3D, anything they host — generates the asset, and drops it into the panel. So I don't just hear the answer. I see it.

Under the hood: Gemini 3.1 Flash Live emits audio and structured tool calls on the same socket. Tavus Phoenix-4 lip-syncs the audio at 1080p, 40 frames a second. Cursor SDK against a Daytona sandbox writes the code over MCP — cloud to cloud, our server isn't even in the data path. Convex streams every event reactively. Exa for research. fal.ai for any model, any output. LiveKit Agents carries it all over WebRTC.

Code creation is no longer the bottleneck. Understanding is. So we built the most natural interface for understanding — a face. Nexus. Software, spoken aloud.
