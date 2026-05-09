# Coding Agent Architecture — How Cursor SDK Generates the UI

> Companion to `architecture.md`. This doc answers: **where does the Cursor SDK actually run, how does it produce code that ends up in the user's browser, and how do we deploy the whole thing on DigitalOcean?**

---

## TL;DR

- **The Cursor SDK is a thin client.** The agent's reasoning happens in Cursor's cloud. Our Node.js backend just *holds the session* and *forwards the event stream*.
- **Generated code never touches our server's filesystem.** The Cursor agent writes files into a **Daytona sandbox** via MCP tool calls. Daytona returns a signed preview URL; the user's browser loads it in an `<iframe>`.
- **Our backend is the conductor.** It orchestrates Gemini Live ↔ Cursor SDK ↔ Daytona ↔ Convex, but does not execute generated code itself.
- **DigitalOcean hosts the conductor.** A single Droplet (or App Platform service) runs the Node.js backend + LiveKit agent worker. Frontend is a static Next.js build served from the same Droplet behind Caddy/Nginx, or from DO App Platform.

---

## 1. The Three Planes

It helps to think of Nexus as three planes that talk over the network. Each runs in a different place, and each owns different data.

```
┌────────────────────────── BROWSER (user's machine) ──────────────────────────┐
│  Next.js UI  •  LiveKit WebRTC client  •  Convex React subscription          │
│  <iframe src="https://daytona-signed-url"> ← rendered generated app          │
└──────────────────────────────────────────────────────────────────────────────┘
                ▲ WebRTC audio/video        ▲ Convex websocket
                │                            │
┌────────────── DIGITALOCEAN DROPLET (our backend) ────────────────────────────┐
│  Node.js orchestrator                                                        │
│  ├─ LiveKit Agents worker (Python or Node)  → talks to Gemini Live + Tavus   │
│  ├─ Cursor SDK client (@cursor/sdk)         → holds Agent session            │
│  └─ Convex mutation pusher                  → forwards stream events         │
└──────────────────────────────────────────────────────────────────────────────┘
                ▲ HTTPS / SSE                ▲ HTTPS
                │                            │
┌──────────── EXTERNAL SAAS (we don't run these) ──────────────────────────────┐
│  Cursor cloud      ── runs composer-2 agent, emits event stream              │
│  Daytona cloud     ── spins sandbox, executes npm install / dev server       │
│  Convex cloud      ── reactive DB, fans out events to all clients            │
│  Gemini Live       ── audio in/out, intent extraction                        │
│  Tavus Phoenix-4   ── avatar rendering                                       │
└──────────────────────────────────────────────────────────────────────────────┘
```

Three rules of thumb:

1. **Tokens never leave our backend.** Cursor, Daytona, Convex, Gemini, and Tavus API keys all live in env vars on the Droplet. The browser only ever sees short-lived signed URLs (Daytona preview, LiveKit room token, Convex client URL).
2. **Generated code lives in Daytona, not in us.** We don't `fs.writeFile` anything. Removes a huge sandboxing/escape concern.
3. **The UI is reactive, not RPC.** The frontend never asks the backend "what's the agent doing?" — it subscribes to Convex and re-renders whenever an event lands.

---

## 2. Where the Cursor SDK Actually Runs

The Cursor SDK is a **Node.js client library**. The actual coding agent (composer-2) runs on Cursor's infrastructure. The SDK is the wire between us and them.

```ts
// runs on the DigitalOcean Droplet, inside our Node.js backend
import { Cursor } from "@cursor/sdk";

const cursor = new Cursor({ apiKey: process.env.CURSOR_API_KEY });

const agent = await cursor.agents.create({
  model: "composer-2",
  // Daytona sandbox is exposed to the agent as an MCP server.
  // The agent calls Daytona tools to write files and run commands.
  mcpServers: {
    daytona: {
      url: daytonaSandbox.mcpUrl,
      auth: daytonaSandbox.mcpToken,
    },
  },
  systemPrompt: "Build the app the user described. Run it on port 3000.",
});

// stream agent events back through Convex to the browser
for await (const event of agent.send(userIntent)) {
  switch (event.type) {
    case "assistant_delta":   // narration text
    case "tool_call":         // about to write a file or run a command
    case "tool_result":       // command finished
    case "status":            // thinking / coding / running
      await convex.mutation(api.events.push, { sessionId, event });
      break;
  }
}
```

### What's happening behind that `agent.send(...)`?

1. Our backend opens an HTTPS streaming connection to Cursor's cloud.
2. Cursor's composer-2 model reasons about the prompt.
3. When it wants to write a file or run a command, it calls a tool exposed by Daytona's MCP server (file system writes, shell exec, port forwarding).
4. **Cursor's cloud talks directly to Daytona's cloud over MCP.** Our backend is not in that data path — we just see *event notifications* about what the agent did.
5. Each event is mirrored to Convex via a mutation. The browser already has a `useQuery` subscription open and re-renders.

This means our Droplet's CPU and RAM stay flat even when the agent is generating thousands of lines of code. We're a coordinator, not a worker.

---

## 3. How "UI Code" Gets to the User's Screen

The generated app is itself a Next.js (or Vite/React) project running inside a Daytona sandbox. The user sees it via an iframe. Here is the exact sequence for **one prompt → one preview**:

```
t=0ms     User: "build a todo app with dark mode"
          → Gemini Live extracts intent, fires tool call to backend

t=20ms    Backend: daytona.sandboxes.create({ image: "node:20" })
                  cursor.agents.create({ mcpServers: { daytona } })

t=110ms   Sandbox ready. Agent starts streaming.
          → Convex event: { state: "THINKING" }

t=400ms   Agent tool_call: fs.writeFile("package.json", ...)
          → Convex event: { state: "CODING", file: "package.json", diff: ... }
          → UI: Monaco editor shows the file appearing line-by-line

t=2.1s    Agent tool_call: fs.writeFile("app/page.tsx", ...)
          → UI: Monaco switches to page.tsx, streaming diff

t=8.3s    Agent tool_call: shell.exec("npm install")
          → Convex event: { state: "RUNNING", stdout: "added 142 packages" }
          → UI: switches to xterm.js terminal view

t=14.0s   Agent tool_call: shell.exec("npm run dev &")
                          + daytona.getPreviewUrl(3000)
          → returns https://3000-{sandbox-id}.daytona.work
          → Convex event: { state: "PREVIEW", url: "..." }
          → UI: <iframe src={url} />

t=14.5s   The user is now using their app, talking to the avatar
          to request changes. Same agent, same sandbox — multi-turn.
```

The key insight: **the UI doesn't render code we generated, it renders an iframe pointing at Daytona.** What we *do* render in the panel (Monaco, terminal, status spinner) is just a live narration of what's happening inside the sandbox, fed by the Convex event stream.

### What about the Generative UI panel itself?

The panel is **part of the host Next.js app** (the one we deploy), not generated. It's a single component that switches between five sub-components based on `event.state`:

| State    | Component                       | Source of truth                       |
| -------- | ------------------------------- | ------------------------------------- |
| THINKING | `<ReasoningSkeleton />`         | Convex `events` table, last status    |
| CODING   | `<MonacoStreamingDiff />`       | Convex `files` table, latest write    |
| RUNNING  | `<XtermLogStream />`            | Convex `logs` table, append-only      |
| PREVIEW  | `<iframe src={previewUrl} />`   | Convex `sandbox` table, signed URL    |
| CHAT     | `<MarkdownResponse />`          | Convex `events` table, assistant text |

The Vercel AI SDK's `useUIState` hook can layer on top of this if we want richer streaming, but it's not strictly required — Convex's reactive query is doing the heavy lifting.

---

## 4. DigitalOcean Deployment

We have two reasonable shapes. Pick based on how much ops we want to do during a hackathon.

### Option A — Single Droplet (recommended for the hackathon)

One $24/mo Droplet (4 GB RAM, 2 vCPU) running everything we own.

```
DigitalOcean Droplet (Ubuntu 24.04)
├─ Caddy (auto-HTTPS, reverse proxy)
│   ├─ nexus.example.com         → Next.js (port 3000)
│   ├─ api.nexus.example.com     → Node orchestrator (port 4000)
│   └─ livekit.nexus.example.com → LiveKit server (port 7880, plus UDP)
├─ Next.js (PM2)                 → static + API routes for session bootstrap
├─ Node orchestrator (PM2)       → Cursor SDK + Convex pusher + intent router
├─ LiveKit Agents worker (PM2)   → Python or Node, talks to Gemini Live
└─ LiveKit server (Docker)       → SFU; needs UDP 50000-60000 open
```

**Why this works for the demo:**
- One server to debug at 2am.
- Caddy gives free TLS in one line of config.
- PM2 keeps everything alive; `pm2 logs` is your console.
- LiveKit can run as a single-node Docker container. For a 1–2 user demo, no clustering needed.
- Cursor SDK, Daytona SDK, Convex, Gemini, Tavus are all SaaS — zero infra on our side.

**Firewall (DO Cloud Firewall):**
- 80/tcp, 443/tcp — public web
- 7881/tcp — LiveKit signaling
- 50000-60000/udp — LiveKit media (this is the one people forget)
- 22/tcp — restrict to your IP

**Env vars on the Droplet (`/etc/nexus.env`, loaded by PM2):**
```
CURSOR_API_KEY=...
DAYTONA_API_KEY=...
CONVEX_DEPLOY_KEY=...
GEMINI_API_KEY=...
TAVUS_API_KEY=...
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
NEXT_PUBLIC_CONVEX_URL=https://....convex.cloud
NEXT_PUBLIC_LIVEKIT_URL=wss://livekit.nexus.example.com
```

### Option B — DigitalOcean App Platform + Managed Droplet for LiveKit

If we want push-to-deploy from GitHub:

- **App Platform service** — Next.js frontend + Node orchestrator (two services in one app).
- **Separate Droplet for LiveKit** — App Platform doesn't expose UDP, and LiveKit needs UDP for WebRTC media. There's no way around this.
- **DO Managed Database (Postgres)** if we ever want session history beyond Convex's free tier.

Cost is similar to Option A but ops surface doubles. Skip unless we already love App Platform.

### What we are *not* deploying ourselves

| Service        | Where it runs               | Why we don't host it                           |
| -------------- | --------------------------- | ---------------------------------------------- |
| Cursor agent   | Cursor's cloud              | The SDK is a client — there's no self-host     |
| Daytona sandbox| Daytona's cloud             | That's the entire product                      |
| Convex DB      | Convex's cloud              | Reactive sync is the value prop; can't replicate |
| Gemini Live    | Google                      | API only                                       |
| Tavus avatar   | Tavus                       | API only                                       |

This is what makes the architecture practical for a hackathon: every hard piece (sandboxing, real-time DB, voice models, avatar rendering) is somebody else's SaaS. Our Droplet only runs the glue.

---

## 5. Deployment Steps (concrete)

```bash
# 1. Provision
doctl compute droplet create nexus \
  --image ubuntu-24-04-x64 --size s-2vcpu-4gb --region nyc3 \
  --ssh-keys $SSH_KEY_ID --enable-monitoring

# 2. On the droplet
apt update && apt install -y nodejs npm caddy docker.io
npm i -g pm2

# 3. Pull the repo
git clone https://github.com/your-org/nexus.git /opt/nexus
cd /opt/nexus && npm install
npm run build  # Next.js production build

# 4. Bring up LiveKit
docker run -d --name livekit \
  -p 7880:7880 -p 7881:7881 -p 50000-60000:50000-60000/udp \
  -e LIVEKIT_KEYS="$LIVEKIT_API_KEY: $LIVEKIT_API_SECRET" \
  livekit/livekit-server --dev

# 5. Start the app
pm2 start ecosystem.config.js   # defines next, orchestrator, livekit-agent
pm2 save && pm2 startup

# 6. Caddy reverse proxy
cat > /etc/caddy/Caddyfile <<EOF
nexus.example.com { reverse_proxy localhost:3000 }
api.nexus.example.com { reverse_proxy localhost:4000 }
livekit.nexus.example.com { reverse_proxy localhost:7880 }
EOF
systemctl reload caddy
```

Caddy handles cert issuance via Let's Encrypt automatically. Point your DNS A records at the Droplet IP and you're up.

---

## 6. Open Questions This Doc Doesn't Answer

These are covered in `questions.md` but worth flagging here because they directly affect deployment:

- **Q6 (iframe embedding):** if Daytona's preview URLs ship with `X-Frame-Options: DENY`, we'll need a same-origin proxy on our Droplet. Caddy can do this with a `reverse_proxy` block, but it adds a hop and we'd need to strip the offending header (`header_down -X-Frame-Options`).
- **Q7 (failure modes):** the Droplet is the single point of failure. For demo day, consider a warm-spare Droplet behind a DO load balancer, even if just for switchover.
- **Q9 (cost):** LiveKit egress on a single Droplet is fine for a few users. If we ever go past a small audience, move LiveKit to LiveKit Cloud and keep only the orchestrator on DO.

---

## 7. Minimum Viable Repo Layout

```
nexus/
├─ apps/
│  ├─ web/                # Next.js frontend (deployed to Droplet)
│  │  └─ app/
│  │     └─ panel/        # Generative UI panel components
│  └─ orchestrator/       # Node.js backend
│     ├─ cursor.ts        # @cursor/sdk client
│     ├─ daytona.ts       # @daytonaio/sdk client
│     ├─ gemini-router.ts # intent extraction → cursor.send
│     └─ convex-pusher.ts # mutation forwarder
├─ services/
│  └─ livekit-agent/      # Python LiveKit Agents worker
├─ convex/                # Convex schema + mutations + queries
├─ infra/
│  ├─ Caddyfile
│  ├─ ecosystem.config.js # PM2
│  └─ deploy.sh
└─ ARCHITECTURE.md (this file)
```

The orchestrator is the only place the Cursor SDK is imported. Everything else either talks to Convex or talks to LiveKit.
