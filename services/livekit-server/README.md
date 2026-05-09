# LiveKit dev server

Phase 3 stands up a local LiveKit SFU in Docker for dev. The agent (in
`services/livekit-agent/`) and the browser (`apps/web/`) connect to it.

## Start

```sh
docker run -d --name nexus-livekit \
  -p 7880:7880 -p 7881:7881 -p 50000-50100:50000-50100/udp \
  livekit/livekit-server --dev
```

`--dev` ships placeholder credentials: API key `devkey`, secret `secret`. These
are baked into `apps/orchestrator/.env.example` and `apps/web/.env.local`.

UDP range is narrowed from the `coding-agent-architecture.md` recommendation
(50000–60000) to 50000–50100 for dev — plenty for ~50 simultaneous tracks and
faster Docker startup.

## Stop / restart

```sh
docker stop nexus-livekit && docker rm nexus-livekit
```

## Without Docker (LiveKit Cloud fallback)

If Docker is not available, sign up at https://cloud.livekit.io, create a
project, and override the env:

```sh
# apps/orchestrator/.env
LIVEKIT_URL=wss://<project>.livekit.cloud
LIVEKIT_API_KEY=APIxxxxxxx
LIVEKIT_API_SECRET=...

# apps/web/.env.local
NEXT_PUBLIC_LIVEKIT_URL=wss://<project>.livekit.cloud
```

Everything else in Phase 3 works unchanged.

## Verify

```sh
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:7880
# expects 404 (LiveKit only handles /rtc and a few special paths over HTTP)
```
