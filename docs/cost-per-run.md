# Nexus Cost Per Run

> Resolves `questions.md` Q9. Marked `[~]` because **live measurement against real keys is not possible in this dev environment** — we don't have Cursor, Daytona, Tavus, Gemini Live, or LiveKit Cloud production keys here. This file therefore documents (a) the per-call cost model from each provider's public pricing, (b) a derived per-demo-run estimate, and (c) the measurement protocol Phase 5 will run against the production droplet to confirm the numbers.

## Cost model — per service

Pricing pulled 2026-05-09 from each provider's public docs / pricing page. The figures are the per-unit rates that drive the per-run total below.

| Service | Unit | Rate (USD) | Source / notes |
|---|---|---:|---|
| **Gemini Live** (`gemini-2.5-flash-preview-native-audio-dialog`) | 1 min audio in/out | ~$0.012 / min input + ~$0.024 / min output (preview pricing band) | [ai.google.dev/pricing](https://ai.google.dev/pricing) — preview SKUs vary; we model the upper band conservatively. |
| **Tavus Phoenix-4 BYO** | 1 min avatar video | ~$0.50 / min (Phoenix-4 BYO tier) | [tavus.io/pricing](https://www.tavus.io/pricing) — BYO is cheaper than CVI mode because Tavus's LLM/TTS are bypassed. |
| **Cursor SDK** | 1 agent.send() request × tokens | ~$0.02 + $0.005/k input tokens + $0.025/k output tokens (composer-2) | [cursor.com/pricing](https://cursor.com/pricing) — the SDK billing follows the IDE pricing tiers; composer-2 is the medium tier. |
| **Daytona** | 1 sandbox-hour (compute) | ~$0.40 / sandbox-hour with hackathon credits ⇒ effectively free | [daytona.io/docs/billing](https://www.daytona.io/docs) — they offered free credits for the hackathon. |
| **LiveKit Cloud** | 1 GB bandwidth | $0.10 / GB; first 50 GB/month free | [livekit.io/pricing](https://livekit.io/pricing) — well within free tier for the demo. |
| **Convex** | 1 function invocation | $0.000_002 per call; first 1M/month free | [convex.dev/pricing](https://www.convex.dev/pricing) — well within free tier for the demo. |
| **Exa** (web_search) | 1 search | $0.005 / search, free up to 1k/month | [exa.ai/pricing](https://exa.ai/pricing) |

## Per-run model — the canonical 3-minute demo

Anchored on `docs/demo-script.md` operational walk-through. Three minutes of avatar time, two `start_build` invocations, one `modify_build`, one `web_search`, one cancel, one export.

| Component | Calculation | Cost (USD) |
|---|---|---:|
| Gemini Live audio | 3 min × $0.024/min (output side dominates) | $0.072 |
| Tavus avatar video | 3 min × $0.50/min | $1.50 |
| Cursor SDK | 3 agent.send() × ~$0.10 (mid-size composer-2 turn, ~3k input + 2k output tokens) | $0.30 |
| Daytona compute | ~5 min sandbox uptime × $0.40/hr ÷ 60 = $0.033 — but **hackathon credits cover this** | $0.00 (effective) |
| LiveKit bandwidth | ~80 MB Tavus video + ~5 MB voice ÷ 1024 = ~0.083 GB × $0.10/GB | $0.008 |
| Convex function calls | ~150 mutations + queries × $0.000_002 | $0.0003 (effectively free) |
| Exa search | 1 × $0.005 | $0.005 |
| **Per-run total** | | **≈ $1.89** |

Most of the burn is **Tavus** (~80% of run cost). That is by design — the avatar is the wow factor.

## Hackathon-day budget

Targeted: **~50 practice runs + 5 judge sessions + 1 stage demo = 56 runs.**

| Source | Runs | Cost |
|---|---:|---:|
| Per-run × 56 | 56 | $105.84 |
| Tavus minutes safety pad (1.5×) | — | +$42 |
| Gemini Live spike pad (1.2×) | — | +$3 |
| **Practice + demo budget** | | **~$150** |

Add **another $50 for the warm-spare droplet's idle time + LiveKit Cloud bandwidth headroom** if Phase 5.10 ships → **~$200 ceiling.**

## What we measured live

`[~]` — Live measurement is gated on having real API keys. The instrumentation is wired in code:

- `apps/orchestrator/src/index.ts` `/api/health` endpoint reports which keys are configured (`cursorKey`, `daytonaKey`, `geminiConfigured`, `tavusConfigured`, `agentDispatchConfigured`).
- The orchestrator's structured pino-pretty logs include `tool: <name>` markers + `[narration] flushed` markers; a 5-minute `pm2 logs` capture during the canonical demo run gives us start_build / modify_build / cancel counts.
- The LiveKit agent logs `agent_state_changed` transitions; per-session totals tell us how many minutes of Gemini Live + Tavus we burned.

When Phase 5 stands up the production droplet, we'll run the canonical demo three times and dump:

```
docs/cost-per-run.actual.md
  ├─ Run 1: <date>, <session-id>, <duration>, <observed cost>
  ├─ Run 2: ...
  └─ Run 3: ...
```

## Pre-run cost gate (optional)

For Phase 5.10 (warm spare) we can wire `/api/health` to refuse new sessions when the budget hits 80% of cap by reading a daily usage counter from Convex. **Not implementing for the hackathon** — the per-run cost is bounded enough that runaway is unlikely.

## Cheapest viable demo (cost floor)

If we have to demo with $10 in keys total:

- Gemini Live → unchanged (cheap).
- Tavus → swap to a smaller-resolution replica (saves ~30%) or fall back to audio-only (saves 100%).
- Cursor → the SDK has a 7-day free trial; use that.
- Daytona → already free with hackathon credits.

That puts the per-run floor at **~$0.60** — viable for ~16 demo runs on $10 in keys, more if Tavus stays in audio-only fallback.

## Open items for Phase 5

- [ ] Run the canonical demo three times against production. Dump observed cost.
- [ ] Wire `/api/health` cost gate (optional).
- [ ] Add per-session billing markers to Convex if Convex bill exceeds the free tier mid-hackathon (it shouldn't).
