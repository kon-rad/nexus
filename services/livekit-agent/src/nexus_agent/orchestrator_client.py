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
    """Async HTTP client for the orchestrator.

    Public surface:
      - update_avatar_state(session_id, state, room) — mirror agent_state_changed
      - notify_tool_call(session_id, name, args) — fire-and-forget tool log
      - post_session(prompt, session_id) — Phase 4: trigger Cursor agent on
        a session. Used by both start_build and modify_build; the orchestrator
        decides whether to Agent.create() or Agent.resume() based on whether
        it has a Cursor agent id cached for the session.
    """

    def __init__(self, base_url: str | None = None, *, timeout_s: float = 5.0) -> None:
        self._base_url = (base_url or os.environ.get("ORCHESTRATOR_URL") or "http://localhost:4000").rstrip("/")
        self._client = httpx.AsyncClient(timeout=timeout_s)
        # POSTs to /api/session block until the orchestrator queues the
        # workflow (it returns 202 immediately) — but the network round-trip
        # itself can spike on first connect. Keep this endpoint's timeout
        # generous so a slow first sandbox spin-up doesn't bubble up as a
        # tool failure. The orchestrator does the heavy work in background.
        self._session_post_timeout_s = max(timeout_s, 15.0)

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

    async def post_session(
        self,
        *,
        prompt: str,
        session_id: str | None = None,
    ) -> dict[str, Any]:
        """POST to /api/session — kicks off Cursor + Daytona for this prompt.

        The orchestrator routes by session_id:
          - present + recognized → resume the existing Cursor agent (multi-turn)
          - present + unknown    → create a new Cursor agent on that session row
          - absent               → create a new session row + agent

        Returns the orchestrator's `{ sessionId }` payload. Raises on
        non-2xx — callers (start_build / modify_build) should catch and
        return a human-readable string to Gemini so the avatar can apologize
        instead of the tool call exploding.
        """
        url = f"{self._base_url}/api/session"
        payload: dict[str, Any] = {"prompt": prompt}
        if session_id:
            payload["sessionId"] = session_id
        r = await self._client.post(
            url, json=payload, timeout=self._session_post_timeout_s
        )
        r.raise_for_status()
        return r.json() or {}

    async def notify_tool_call(
        self,
        *,
        session_id: str | None,
        name: str,
        args: dict[str, Any],
    ) -> None:
        """Fire-and-forget audit log of a tool call. Phase 4 also has
        `tool_call()` below which is the routed path; this one is kept for
        backward compatibility and audit-only hits.
        """
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

    async def tool_call(
        self,
        *,
        session_id: str | None,
        name: str,
        args: dict[str, Any],
    ) -> dict[str, Any] | None:
        """Phase 4 routed tool call. POSTs to /api/avatar/tool-call and
        returns the orchestrator's response payload (which includes the
        resolved sessionId for start_build / modify_build / stop_build).

        Returns None on transport failure so the caller can return a
        graceful "could not reach the build system" string to the model.
        """
        url = f"{self._base_url}/api/avatar/tool-call"
        body: dict[str, Any] = {"name": name, "args": args}
        if session_id:
            body["sessionId"] = session_id
        try:
            r = await self._client.post(
                url, json=body, timeout=self._session_post_timeout_s
            )
            r.raise_for_status()
            return r.json() or {}
        except httpx.HTTPError as e:
            logger.warning("tool_call(%s) failed: %s", name, e)
            return None
