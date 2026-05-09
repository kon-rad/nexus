# Nexus — UI/UX Design System Prompt

> **For the Design Team.** This document is the complete design brief for the Nexus web app. Nexus is an AI pair programmer: the user video-calls a real-time AI avatar on the left side of the screen and watches it write, run, and preview full-stack code on the right. Every design decision should reinforce two feelings — **trust in the AI's intelligence** and **delight in the speed of creation**.

---

## 1. Global Design Language

**Theme: "Midnight Glass."** Nexus is a dark-mode exclusive, premium developer tool. The aesthetic draws from Cursor IDE, Vercel's dashboard, and Linear — tools that feel native, fast, and deeply considered. There is no light mode. The canvas is deep space, and the AI's presence is the light.

### Color System

| Token | Value | Usage |
|---|---|---|
| `--bg-canvas` | `#0A0A0A` | Main app background |
| `--bg-surface` | `#121212` | Panels, sidebars, cards |
| `--bg-elevated` | `#1A1A1A` | Modals, dropdowns, tooltips |
| `--border-subtle` | `#27272A` | 1px dividers between panels |
| `--accent-cyan` | `#00E5FF` | Primary CTA, active states, AI speaking indicator |
| `--accent-purple` | `#B026FF` | Gradients, AI thinking state, hover glows |
| `--text-primary` | `#FFFFFF` | Headings, active labels |
| `--text-secondary` | `#A1A1AA` | Body text, code comments, metadata |
| `--text-danger` | `#FF4444` | Error states, danger zone actions |

The accent colors (`--accent-cyan` and `--accent-purple`) are used sparingly. They should appear as glows, gradients, and active indicators — never as large filled surfaces. The visual hierarchy is built on elevation (surface depth) and typography weight, not color.

### Typography

The UI uses **Inter** (or Geist) for all interface text — a clean, geometric sans-serif that reads well at small sizes in dense developer interfaces. All code, terminal output, and file names use **JetBrains Mono** (or Fira Code), with ligatures enabled. The type scale follows a strict 4pt baseline grid.

| Role | Font | Size | Weight |
|---|---|---|---|
| Hero Headline | Inter | 56–72px | 700 Bold |
| Section Heading | Inter | 28–36px | 600 SemiBold |
| UI Label | Inter | 13–14px | 500 Medium |
| Body / Description | Inter | 15–16px | 400 Regular |
| Code / Terminal | JetBrains Mono | 13px | 400 Regular |

### Visual Effects

Glassmorphism is applied selectively to floating elements: the top navigation bar, the avatar overlay pill, tooltips, and dropdowns. The formula is `background: rgba(18, 18, 18, 0.7)` with `backdrop-filter: blur(12px)` and a 1px `--border-subtle` border. Glow effects are radial gradients (`radial-gradient`) placed behind the AI avatar to signal its active state — cyan for listening, purple for thinking, white for speaking.

---

## 2. Landing Page

**Goal:** Convert developers and technical founders in under 10 seconds by showing the product in action.

### Hero Section

The hero is full-viewport-height with a deep black background. The headline reads **"Your AI Co-Founder is Online."** in large, bold type, with a gradient sweep from `--accent-cyan` to `--accent-purple` on the word "Online." Below it, a single-sentence subheadline: *"Talk to Nexus. Watch it write, run, and ship full-stack apps in real time."* The primary CTA is a glowing pill button ("Start Building — Free") with a subtle cyan border glow on hover. A secondary ghost button ("Watch Demo") sits beside it.

The hero's right side (or center-bottom on mobile) features a large, high-fidelity mockup of the main workspace — the split-screen avatar + code panel — rendered slightly tilted in 3D perspective with a soft neon halo behind it. This is the most important visual on the page.

### Below the Fold

A thin strip of monochrome sponsor logos reads: "Powered by Gemini Live · Tavus Phoenix-4 · Cursor SDK · Daytona · Convex." Below that, a 3-column features grid uses icon + headline + one-line description to highlight the three core value propositions: **Real-Time Voice** (Gemini Live), **Secure Code Execution** (Daytona), and **Instant Live Preview** (Daytona signed URLs). The page ends with a single, full-width CTA section repeating the primary button.

---

## 3. Main Web App — The Workspace

**Goal:** The core product experience. A split-screen workspace that balances human connection (avatar) with technical depth (code output). It should feel like pairing with a senior engineer who also happens to be on a video call with you.

### Layout

The workspace is a two-column split screen with a draggable resize handle in the center. The left panel defaults to 30% width and the right panel to 70%. The top navigation bar spans the full width of the right panel only.

### Left Panel: The AI Avatar

The left panel is a cinematic, edge-to-edge video feed of the Tavus Phoenix-4 avatar — no padding, no border, no chrome. The video fills the entire panel. Two overlay elements sit on top of the video. At the bottom center, a glassmorphic pill contains the microphone mute toggle, an end-call button, and a real-time audio waveform visualizer that reacts to the user's voice. At the top left, a minimal status badge displays the AI's current state: a green dot for "Listening," a pulsing purple dot for "Thinking," and a cyan dot for "Speaking." The avatar's background glow changes color to match these states.

### Right Panel: Generative UI

The right panel is a tabbed interface styled like a modern IDE. The top navigation bar contains the three tabs on the left side and the action buttons on the right side.

**Tab Navigation:**

| Tab | Icon | Content |
|---|---|---|
| **Live Preview** | `▶` | Embedded `<iframe>` showing the live Daytona app |
| **Code Inspection** | `</>` | Monaco editor with file tree sidebar |
| **Insights** | `💡` | AI explanation (top) + xterm.js terminal (bottom) |

**Action Buttons (top-right of the right panel):**

| Button | Icon | Action |
|---|---|---|
| Export Code | Download/Zip | Downloads the full Daytona workspace as a ZIP |
| Settings | Cog | Opens a settings modal |
| User Avatar | Circular profile photo | Navigates to the Profile Page |

**Live Preview Tab** renders the Daytona signed preview URL inside a full-panel `<iframe>`. It is styled to look like a browser window inside the app, with a fake URL bar showing the preview URL and a "Copy URL" icon button at the far right of that bar.

**Code Inspection Tab** renders a Monaco-style editor. A narrow left sidebar shows the generated file tree (e.g., `src/App.tsx`, `package.json`). The main editor area shows syntax-highlighted code with the same color theme as the app. As the Cursor SDK agent writes code, characters stream in live — the cursor blinks at the end of the last written line.

**Insights Tab** is split horizontally. The top half shows markdown-formatted explanations from the AI ("I created a React component that..."). The bottom half is a dark `xterm.js` terminal showing live `stdout` and `stderr` from the Daytona sandbox. Both sections auto-scroll to the latest content.

---

## 4. Profile & Settings Page

**Goal:** A clean, focused settings experience. Not a distraction — a utility.

The profile page is a centered, narrow container (max-width 800px) rendered over the same dark canvas. The header displays the user's circular avatar, their display name in H2, and their email in secondary text. The page is divided into three sections separated by `--border-subtle` dividers.

The **Account** section shows the subscription tier ("Nexus Pro"), a usage summary table (minutes used this month, sandboxes created, code exports), and a "Manage Subscription" link. The **Integrations** section contains labeled input fields for optional API keys the user can bring (GitHub token for code exports, custom OpenAI key). The **Preferences** section offers a dropdown for Avatar Voice selection (e.g., "Aiden," "Nova"), a toggle for terminal font size, and a toggle for enabling/disabling the AI thinking indicator glow. At the bottom, a **Danger Zone** section contains a single "Delete Account" button with a muted red outline — no fill, no drama, just a clear affordance.

---

## 5. Component Prompt Summary

The following table summarizes the key UI components and their design prompt for the design tool (Figma/Framer):

| Component | Design Prompt |
|---|---|
| **Primary Button** | Pill shape, `--accent-cyan` border glow on hover, dark fill, white text, 14px Medium |
| **Ghost Button** | Pill shape, `--border-subtle` border, transparent fill, secondary text, glow on hover |
| **Tab Bar** | Flat, no underline, active tab has `--accent-cyan` bottom border 2px, inactive is secondary text |
| **Avatar Status Badge** | 8px circle, color-coded (green/purple/cyan), subtle pulse animation on "Thinking" state |
| **Glassmorphic Pill** | `rgba(18,18,18,0.7)` fill, `blur(12px)`, `--border-subtle` border, 9999px border-radius |
| **Code Editor** | Monaco theme: background `#0A0A0A`, syntax colors: cyan for keywords, purple for strings |
| **Terminal** | xterm.js, background `#000000`, green `#00FF41` for stdout, red `#FF4444` for stderr |
| **iframe Browser Shell** | Fake URL bar with lock icon, URL text in secondary color, "Copy URL" icon button on right |
| **Profile Avatar** | 40px circle, subtle cyan ring on hover, initials fallback if no photo |
