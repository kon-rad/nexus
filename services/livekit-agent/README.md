# Nexus LiveKit Agent

Phase 3 voice + avatar worker. Joins LiveKit rooms, runs Gemini Live as the
realtime LLM, hands its audio to a Tavus Phoenix-4 avatar (BYO LLM mode), and
mirrors the resulting state transitions back to the orchestrator over HTTP.

See `docs/voice-architecture.md` for the topology this implements.

## Layout

```
services/livekit-agent/
├─ pyproject.toml
├─ .env.example
└─ src/nexus_agent/
   ├─ __init__.py
   ├─ worker.py        # cli.run_app entrypoint + JobContext handler
   ├─ agent.py         # NexusAgent + state forwarder
   └─ orchestrator_client.py  # thin HTTP client for /api/avatar/state
```

## Setup

```sh
cd services/livekit-agent
python3.11 -m venv .venv
source .venv/bin/activate
pip install -e .[dev]
cp .env.example .env  # then fill in GOOGLE_API_KEY / TAVUS_* values
```

## Run a worker (development)

```sh
source .venv/bin/activate
nexus-agent dev
```

The `dev` subcommand comes from `livekit.agents.cli` and registers the worker
against `$LIVEKIT_URL`. Once registered, any browser that fetches a JWT with
`agentName=nexus-voice-agent` from the orchestrator's `/api/livekit/token`
endpoint will dispatch a job to this worker.

## Type checking

```sh
pyright
```

We pin Pyright in strict mode for `src/nexus_agent`. Plugin imports
(`livekit.plugins.google`, `livekit.plugins.tavus`) are best-effort imported and
fall through to runtime errors with clear messages if the package is missing —
this lets us scaffold without API keys.

## Phase 3 vs Phase 4

Phase 3 ships the wiring with one no-op tool (`chat_status`). Phase 4 adds
`start_build(intent)` and a `narrate(text)` data-channel injector. Edit
`src/nexus_agent/agent.py` to extend tools — do not re-architect the worker.
