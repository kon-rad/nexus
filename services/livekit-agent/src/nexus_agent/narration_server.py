"""Phase 4.5 — narration HTTP server.

Solves Q3 (dead-air during codegen). The orchestrator's Cursor event loop
forwards rate-limited `assistant_delta` text fragments to this server via
HTTP. The server looks up the active `AgentSession` for the room (keyed by
sessionId) and calls `session.say(text)` so the avatar speaks the line.

Why an HTTP server, not a Convex subscription:
- The Python Convex SDK has no reactive subscription surface (it's a sync
  client). Polling per session would burn quota.
- The orchestrator already speaks HTTP to the agent for state mirroring.
  One more endpoint is a $0 addition to the protocol surface.
- The orchestrator runs in the same network neighborhood, so HTTP latency
  is a small fraction of Gemini Live's TTFT.

Server lifecycle:
- The first call to `register_narration_session` boots an aiohttp app on
  `NARRATION_PORT` (default 4100). Subsequent calls just add to the
  in-memory map.
- On worker shutdown we tear down the runner. (livekit-agents 1.5 doesn't
  give us a tidy "process exit" hook, so we lean on the asyncio task
  cleanup that JobContext shutdown callbacks fire.)
"""

from __future__ import annotations

import asyncio
import logging
import os
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from livekit.agents import AgentSession

logger = logging.getLogger(__name__)

# Map sessionId → live AgentSession. Populated by register_narration_session.
_SESSIONS: dict[str, AgentSession] = {}

# Orchestrator-facing aiohttp runner. Lazily started on first registration.
_runner: Any = None
_app: Any = None
_runner_lock = asyncio.Lock()


def register_narration_session(session_id: str, session: AgentSession) -> None:
    """Bind a sessionId to an AgentSession so HTTP narration POSTs route here."""
    _SESSIONS[session_id] = session
    logger.info("narration session registered: %s", session_id)
    # Boot the HTTP runner once. fire-and-forget — the running loop owns it.
    loop = asyncio.get_running_loop()
    loop.create_task(_ensure_runner())


def unregister_narration_session(session_id: str) -> None:
    if _SESSIONS.pop(session_id, None) is not None:
        logger.info("narration session unregistered: %s", session_id)


async def _ensure_runner() -> None:
    global _runner, _app
    async with _runner_lock:
        if _runner is not None:
            return
        try:
            from aiohttp import web  # noqa: PLC0415
        except ImportError:  # pragma: no cover
            logger.warning(
                "aiohttp not available — narration channel disabled. The "
                "avatar will not narrate during codegen."
            )
            return

        app = web.Application()

        async def narrate(req: web.Request) -> web.Response:
            try:
                body = await req.json()
            except Exception:
                return web.json_response({"error": "invalid json"}, status=400)
            sid = body.get("sessionId")
            text = body.get("text")
            if not isinstance(sid, str) or not isinstance(text, str) or not text.strip():
                return web.json_response(
                    {"error": "sessionId and non-empty text required"},
                    status=400,
                )
            session = _SESSIONS.get(sid)
            if session is None:
                # Common: the orchestrator pushed narration before the
                # agent finished startup, or the user already left. Quiet.
                return web.json_response({"ok": True, "queued": False})
            try:
                # Run as a non-interrupting narration. add_to_chat_ctx=False
                # so the line doesn't pollute the model's chat context — this
                # is one-shot stage direction, not a conversational turn.
                handle = session.say(
                    text.strip(),
                    allow_interruptions=True,
                    add_to_chat_ctx=False,
                )
                logger.info("narrated %d chars to %s: %s", len(text), sid, text[:80])
                _ = handle  # discard; we don't need to await it.
            except Exception as e:
                logger.warning("session.say failed: %s", e)
                return web.json_response({"error": str(e)}, status=500)
            return web.json_response({"ok": True, "queued": True})

        async def health(_: web.Request) -> web.Response:
            return web.json_response(
                {"ok": True, "registered": list(_SESSIONS.keys())}
            )

        app.router.add_post("/narrate", narrate)
        app.router.add_get("/health", health)

        runner = web.AppRunner(app)
        await runner.setup()
        port = int(os.environ.get("NARRATION_PORT", "4100"))
        host = os.environ.get("NARRATION_HOST", "127.0.0.1")
        site = web.TCPSite(runner, host, port)
        try:
            await site.start()
            logger.info("narration server listening on %s:%s", host, port)
        except OSError as e:
            # Port already in use — happens if a previous worker didn't clean
            # up. Log and continue without narration.
            logger.warning("narration server bind failed (%s) — disabled", e)
            await runner.cleanup()
            return
        _runner = runner
        _app = app


async def shutdown_narration_server() -> None:
    """Stop the aiohttp runner. Called on worker shutdown."""
    global _runner, _app
    if _runner is not None:
        try:
            await _runner.cleanup()
        finally:
            _runner = None
            _app = None
            _SESSIONS.clear()
