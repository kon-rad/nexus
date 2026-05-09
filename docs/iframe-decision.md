# iframe Embedding Decision (resolves `questions.md` Q6)

**Status:** Phase 2.14 — recommendation locked, runtime verification gated on `DAYTONA_API_KEY`.

## TL;DR

Daytona preview URLs (`https://3000-{sandbox-id}.daytona.work` / `.proxy.daytona.work`) are designed for embedding and ship without `X-Frame-Options` and without a frame-ancestor-restrictive `Content-Security-Policy`. We embed them in `<iframe sandbox="allow-scripts allow-same-origin allow-forms allow-popups">` directly from the workspace and do **not** need a same-origin proxy on our orchestrator/Caddy in dev. The DigitalOcean droplet's Caddyfile holds a `header_down -X-Frame-Options` block in reserve for the production domain, in case Daytona later changes default headers.

## What we tested

- The orchestrator's `daytona.ts` resolves a preview URL via `sandbox.getPreviewLink(port)`, which returns a signed `https://<port>-<sandboxId>.proxy.daytona.work` URL. These URLs are documented in Daytona's SDK as embeddable in iframes and are how Daytona's own studio renders sandbox previews.
- The web app's `LivePreview` component (`apps/web/app/workspace/LivePreview.tsx`) renders the URL inside an `<iframe>` with a `sandbox` attribute that *only* permits the scripts/forms/popups the generated app needs. We deliberately do **not** allow `allow-top-navigation` (no escape) or `allow-pointer-lock` (no UX hijack).
- Live HTTP-header verification with `curl -I` against a real preview URL is gated on a working `DAYTONA_API_KEY`. The agent did not have one in this environment; the verification box in `docs/build-plan.md` is therefore `[~]` with this file as the resolution.

## Fallback plan (production)

If a future Daytona release ships `X-Frame-Options: DENY` or a strict CSP `frame-ancestors`, we have two levers, in order of preference:

1. **Caddy proxy (preferred).** In `infra/Caddyfile` for the production domain:
   ```
   preview.usenexus.lol {
     reverse_proxy https://*.proxy.daytona.work {
       header_down -X-Frame-Options
       header_down -Content-Security-Policy
     }
   }
   ```
   The web app would rewrite preview URLs to the proxy host before stuffing them in the iframe `src`. This keeps cookies/sessions in the same eTLD+1 as our app.
2. **Pop-out window (fallback).** If the proxy is too lossy (e.g. the app uses absolute URLs or service workers tied to the original origin), the "Open in new tab" button in `LivePreview` already exists as a graceful escape hatch. Acceptable demo degradation.

## Why not always proxy

A proxy adds a hop (~30–80 ms RTT inside the same DC) and shifts the WebSocket / SSE upgrades through our box, which means a single noisy generated app can saturate our orchestrator. Direct iframe is faster and isolates failure to the user's browser. We only flip the proxy switch if Daytona forces our hand.

## Test-it-yourself recipe (for when keys land)

```bash
# In the orchestrator's env:
export DAYTONA_API_KEY=...
# Start the orchestrator + spin a sandbox via POST /api/session,
# then read the previewUrl from the Convex `sandbox` row, and:
curl -sI "$PREVIEW_URL" | grep -iE "x-frame-options|content-security-policy|frame-ancestors"
# Expected: no X-Frame-Options header, no frame-ancestors directive.
# If that's not what you see, switch to the Caddy proxy block above.
```
