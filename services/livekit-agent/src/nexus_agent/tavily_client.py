"""Thin Tavily client used by the web_search tool.

Tavily's REST API is a single POST to /search with an API key in the body.
We avoid the official `tavily-python` SDK to keep the dep tree small — one
extra package on this side has measurable cold-start cost on the worker.

The tool result is plain text shaped for voice: a short answer if Tavily
returned one, plus up to N numbered snippets. Capped to ~1500 chars so it
doesn't blow Gemini Live's working context.
"""

from __future__ import annotations

import logging
import os
from typing import Any

import httpx

logger = logging.getLogger(__name__)

TAVILY_URL = "https://api.tavily.com/search"
DEFAULT_MAX_RESULTS = 5
DEFAULT_TIMEOUT_S = 10.0
RESULT_CHAR_BUDGET = 1500


class TavilyClient:
    """Async wrapper. Always returns a plain string from `search()` — never raises."""

    def __init__(
        self,
        api_key: str | None = None,
        *,
        max_results: int = DEFAULT_MAX_RESULTS,
        timeout_s: float = DEFAULT_TIMEOUT_S,
    ) -> None:
        self._api_key = api_key or os.environ.get("TAVILY_API_KEY")
        self._max_results = max_results
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
                "web search is not configured — TAVILY_API_KEY is missing on the "
                "agent worker."
            )
        if not query.strip():
            return "no query provided"

        try:
            r = await self._client.post(
                TAVILY_URL,
                json={
                    "api_key": self._api_key,
                    "query": query,
                    "max_results": self._max_results,
                    "search_depth": "basic",
                    "include_answer": True,
                },
            )
            r.raise_for_status()
            data: dict[str, Any] = r.json()
        except httpx.HTTPError as e:
            logger.warning("tavily search failed: %s", e)
            return f"search failed: {e}"
        except Exception as e:  # pragma: no cover — JSON decode etc.
            logger.warning("tavily response parse failed: %s", e)
            return f"search failed: {e}"

        return _format_results(data, max_results=self._max_results)


def _format_results(data: dict[str, Any], *, max_results: int) -> str:
    """Compose top answer + N snippets into one budgeted string."""
    parts: list[str] = []
    if answer := (data.get("answer") or "").strip():
        parts.append(answer)
    for i, result in enumerate(data.get("results", [])[:max_results], start=1):
        title = (result.get("title") or "").strip()
        content = (result.get("content") or "").strip()
        if title and content:
            parts.append(f"{i}. {title}: {content}")
    if not parts:
        return "no results"

    out = "\n".join(parts)
    if len(out) > RESULT_CHAR_BUDGET:
        out = out[:RESULT_CHAR_BUDGET].rstrip() + "..."
    return out
