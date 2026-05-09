"""Thin Exa client used by the web_search tool.

Exa's REST API is a single POST to /answer with the API key in an
`x-api-key` header. /answer runs Exa's own LLM internally and returns a
synthesized one-paragraph answer plus citations — closer to "ask, get a
sentence" than Tavily's snippet-collection shape, which is the right fit
for a voice agent.

We avoid the official `exa-py` SDK to keep the dep tree small (httpx is
already in our deps for the orchestrator client). The public surface
matches the previous TavilyClient one-for-one — `is_configured`,
`aclose()`, `search(query) -> str` — so swapping back, or to a third
provider later, is a one-file change.

Pricing reference (May 2026): $5 / 1000 requests, free tier 1000 credits.
"""

from __future__ import annotations

import logging
import os
from typing import Any

import httpx

logger = logging.getLogger(__name__)

EXA_ANSWER_URL = "https://api.exa.ai/answer"
DEFAULT_TIMEOUT_S = 12.0
DEFAULT_MODEL = "exa"  # cheaper + fast; "exa-pro" is sharper at 2-3x latency
RESULT_CHAR_BUDGET = 1500


class ExaClient:
    """Async wrapper around POST /answer. Always returns a string from `search()`."""

    def __init__(
        self,
        api_key: str | None = None,
        *,
        timeout_s: float = DEFAULT_TIMEOUT_S,
        model: str = DEFAULT_MODEL,
    ) -> None:
        self._api_key = api_key or os.environ.get("EXA_API_KEY")
        self._model = model
        self._client = httpx.AsyncClient(timeout=timeout_s)

    @property
    def is_configured(self) -> bool:
        return bool(self._api_key)

    async def aclose(self) -> None:
        await self._client.aclose()

    async def search(self, query: str) -> str:
        """Run a search and return a voice-friendly summary string.

        Always returns a string. Errors are caught and returned as a
        human-readable message so the LLM can apologize naturally instead
        of the tool call exploding.
        """
        if not self._api_key:
            return (
                "web search is not configured — EXA_API_KEY is missing on the "
                "agent worker."
            )
        if not query.strip():
            return "no query provided"

        try:
            r = await self._client.post(
                EXA_ANSWER_URL,
                headers={
                    "x-api-key": self._api_key,
                    "content-type": "application/json",
                },
                json={"query": query, "model": self._model},
            )
            r.raise_for_status()
            data: dict[str, Any] = r.json()
        except httpx.HTTPError as e:
            logger.warning("exa search failed: %s", e)
            return f"search failed: {e}"
        except Exception as e:  # pragma: no cover — JSON decode etc.
            logger.warning("exa response parse failed: %s", e)
            return f"search failed: {e}"

        return _format_answer(data)


def _format_answer(data: dict[str, Any]) -> str:
    """Compose Exa's synthesized answer + top citation into one budgeted string."""
    answer = (data.get("answer") or "").strip()
    citations = data.get("citations") or []

    if not answer:
        return "no answer found"

    # Voice-friendly: append the top citation only. The model already has a
    # synthesized answer — extra citations bloat context and tempt Gemini
    # into reading URLs aloud.
    parts = [answer]
    if citations:
        top = citations[0]
        title = (top.get("title") or "").strip()
        url = (top.get("url") or "").strip()
        if title and url:
            parts.append(f"Source: {title} ({url})")
        elif title:
            parts.append(f"Source: {title}")

    out = "\n".join(parts)
    if len(out) > RESULT_CHAR_BUDGET:
        out = out[:RESULT_CHAR_BUDGET].rstrip() + "..."
    return out
