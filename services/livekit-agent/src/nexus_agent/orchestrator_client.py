"""Tiny HTTP client used by the LiveKit agent to talk to the orchestrator.

The agent NEVER touches Convex directly. All state mutations flow through the
orchestrator so the orchestrator stays the single owner of the Convex client.
This keeps secrets (CONVEX_DEPLOY_KEY) out of the Python process.
"""

from __future__ import annotations

import logging
import os
from typing import Any

import httpx

logger = logging.getLogger(__name__)


class OrchestratorClient:
    """Async HTTP client for the orchestrator's /api/avatar/* surface.

    Public surface (Phase 3):
      - update_avatar_state(session_id, state, room) — mirror agent_state_changed
      - notify_tool_call(session_id, name, args) — fire-and-forget tool log

    Phase 4 will add post_intent(session_id, intent) for start_build.
    """

    def __init__(self, base_url: str | None = None, *, timeout_s: float = 5.0) -> None:
        self._base_url = (base_url or os.environ.get("ORCHESTRATOR_URL") or "http://localhost:4000").rstrip("/")
        self._client = httpx.AsyncClient(timeout=timeout_s)

    async def aclose(self) -> None:
        await self._client.aclose()

    async def update_avatar_state(
        self,
        *,
        session_id: str | None,
        avatar_state: str,
        livekit_room: str | None = None,
    ) -> None:
        """Mirror an `AgentStateChangedEvent` into the orchestrator.

        Best-effort: a 5xx or network error is logged but does not abort the agent.
        """
        if not session_id:
            # No session yet — Phase 3 boots before any prompt is spoken. The
            # orchestrator's ensureVoiceSession lazily creates a row when the
            # client first asks for a token, so this is a benign warm-up.
            logger.debug("update_avatar_state(state=%s) skipped — no sessionId", avatar_state)
            return
        url = f"{self._base_url}/api/avatar/state"
        payload: dict[str, Any] = {
            "sessionId": session_id,
            "avatarState": avatar_state,
        }
        if livekit_room is not None:
            payload["livekitRoom"] = livekit_room
        try:
            r = await self._client.post(url, json=payload)
            r.raise_for_status()
        except httpx.HTTPError as e:
            logger.warning("update_avatar_state failed: %s", e)

    async def notify_tool_call(
        self,
        *,
        session_id: str | None,
        name: str,
        args: dict[str, Any],
    ) -> None:
        """Phase 3 stub. Forwards Gemini tool calls. Phase 4 routes start_build."""
        if not session_id:
            logger.debug("notify_tool_call(name=%s) skipped — no sessionId", name)
            return
        url = f"{self._base_url}/api/avatar/tool-call"
        try:
            r = await self._client.post(
                url,
                json={"sessionId": session_id, "name": name, "args": args},
            )
            r.raise_for_status()
        except httpx.HTTPError as e:
            logger.warning("notify_tool_call(%s) failed: %s", name, e)
