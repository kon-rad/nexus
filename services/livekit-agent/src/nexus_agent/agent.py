"""Nexus voice agent: Gemini Live + Tavus BYO + three Phase 4 tools.

The agent is a thin wrapper around livekit.agents.AgentSession:

- LLM:    livekit.plugins.google.beta.realtime.RealtimeModel  (Gemini Live)
- Avatar: livekit.plugins.tavus.AvatarSession                 (BYO LLM mode)

The audio output of the realtime model is automatically subscribed to by the
avatar plugin (per livekit.docs > Virtual avatar models > Usage), so we don't
manually wire any audio pipes — `AvatarSession.start(session, room)` does it.

The agent listens to AgentSession lifecycle events and forwards each transition
to the orchestrator over HTTP, which mirrors them to Convex
(`sessions.avatarState`). The browser's `useQuery` updates the StatusBadge.

Phase 4 tools:
  - start_build(intent)  → POST /api/session  (kicks Cursor + Daytona)
  - modify_build(change) → POST /api/session  (resume same Cursor agent)
  - web_search(query)    → Exa /answer, agent-side. Never hits the orchestrator.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import TYPE_CHECKING, Any

from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    RunContext,
    function_tool,
)

if TYPE_CHECKING:
    from livekit.agents import AgentStateChangedEvent

from .exa_client import ExaClient
from .narration_server import (
    register_narration_session,
    shutdown_narration_server,
    unregister_narration_session,
)
from .orchestrator_client import OrchestratorClient

logger = logging.getLogger(__name__)


# ---- Plugin imports (best-effort) ------------------------------------------
# We import lazily so `pyright` and unit-style imports work without the heavy
# google/tavus extras installed. At runtime the plugins are required.
try:  # pragma: no cover — import side-effects only
    from livekit.plugins import google as _google
except ImportError:  # pragma: no cover
    _google = None  # type: ignore[assignment]

try:  # pragma: no cover
    from livekit.plugins import tavus as _tavus
except ImportError:  # pragma: no cover
    _tavus = None  # type: ignore[assignment]


# ---- System prompt loading -------------------------------------------------
# Source of truth: services/livekit-agent/prompts/system_prompt.txt
# Documented in: docs/voice-system-prompt.md
#
# We load at import time so a malformed/missing prompt fails the worker
# startup loudly rather than silently using a fallback in production.

_PROMPT_PATH = (
    Path(__file__).resolve().parent.parent.parent / "prompts" / "system_prompt.txt"
)


def _load_system_prompt() -> str:
    if not _PROMPT_PATH.exists():
        raise RuntimeError(
            f"System prompt missing at {_PROMPT_PATH}. "
            "See docs/voice-system-prompt.md for the source of truth."
        )
    text = _PROMPT_PATH.read_text(encoding="utf-8").strip()
    if not text:
        raise RuntimeError(f"System prompt at {_PROMPT_PATH} is empty.")
    return text


SYSTEM_INSTRUCTIONS = _load_system_prompt()

# Default Gemini Live model + voice. Overridable via env for cost tuning.
DEFAULT_MODEL = os.environ.get(
    "GEMINI_REALTIME_MODEL", "gemini-2.5-flash-preview-native-audio-dialog"
)
DEFAULT_VOICE = os.environ.get("GEMINI_REALTIME_VOICE", "Puck")


# ---------------------------------------------------------------------------
# Agent class
# ---------------------------------------------------------------------------


class NexusAgent(Agent):
    """The voice persona. Three Phase 4 tools registered below."""

    def __init__(
        self,
        *,
        client: OrchestratorClient,
        exa: ExaClient,
        session_id: str | None,
        on_session_resolved: Any = None,
        tools: list[Any] | None = None,
    ) -> None:
        super().__init__(instructions=SYSTEM_INSTRUCTIONS, tools=tools or [])
        self._client = client
        self._exa = exa
        # The "active build session" — same as the voice session. The first
        # start_build call lands on this row in Convex; modify_build reuses
        # it.
        self._session_id = session_id
        # Callback invoked when start_build / modify_build resolve a (possibly
        # new) sessionId. The entrypoint passes a closure that writes the id
        # onto the local participant's attributes so the frontend picks it up
        # via room.localParticipant attributes.
        self._on_session_resolved = on_session_resolved

    async def _publish_resolved_session(self, sid: str) -> None:
        if not sid:
            return
        # Re-register narration in case the sessionId changed (start_build
        # may produce a new row when the prior one was voice-only).
        try:
            register_narration_session(sid, self.session)  # type: ignore[arg-type]
        except Exception as e:  # pragma: no cover
            logger.debug("narration re-register raised: %s", e)
        if self._on_session_resolved is not None:
            try:
                await self._on_session_resolved(sid)
            except Exception as e:  # pragma: no cover
                logger.warning("on_session_resolved raised: %s", e)

    # -- Tools --------------------------------------------------------------

    @function_tool()
    async def start_build(self, context: RunContext, intent: str) -> str:  # noqa: ARG002
        """Trigger a new application build.

        Call when the user describes something to build. The orchestrator
        spins a Daytona sandbox and a Cursor agent; code streams into the
        right panel. While it runs (10–60s), keep talking to the user.

        Args:
            intent: The user's request as a single sentence — what they
                want plus enough technical specifics for the coding agent
                to act on.
        """
        logger.info("tool: start_build(intent=%r)", intent)
        result = await self._client.tool_call(
            session_id=self._session_id,
            name="start_build",
            args={"intent": intent},
        )
        if result is None:
            return "could not reach the build system — try again in a moment"
        sid = result.get("sessionId")
        if isinstance(sid, str) and sid:
            self._session_id = sid
            await self._publish_resolved_session(sid)
        # Return a short, identifier-free string so Gemini doesn't have a
        # chance to read a session id aloud. The avatar's narration during
        # codegen is driven by the system prompt + the orchestrator's
        # narration channel (Phase 4.5).
        return "build started"

    @function_tool()
    async def modify_build(self, context: RunContext, change: str) -> str:  # noqa: ARG002
        """Apply a follow-up change to the active build.

        Same session, same Daytona sandbox, same Cursor agent. The agent
        receives `change` as its next turn and edits in place.

        Args:
            change: The user's modification request — what to change,
                in their words plus enough specifics for the coding agent.
        """
        logger.info("tool: modify_build(change=%r)", change)
        if not self._session_id:
            return "no build to modify yet — call start_build first"
        result = await self._client.tool_call(
            session_id=self._session_id,
            name="modify_build",
            args={"change": change},
        )
        if result is None:
            return "could not reach the build system — try again in a moment"
        sid = result.get("sessionId") or self._session_id
        if isinstance(sid, str) and sid != self._session_id:
            self._session_id = sid
            await self._publish_resolved_session(sid)
        return "changes queued"

    @function_tool()
    async def web_search(self, context: RunContext, query: str) -> str:  # noqa: ARG002
        """Search the web for current information.

        Use when the answer depends on current state of the world: latest
        versions, today's recommended frameworks, current pricing, news.
        Returns up to ~1500 chars of plain text — Gemini will summarize
        for the user.

        Args:
            query: The search query.
        """
        logger.info("tool: web_search(query=%r)", query)
        if not self._exa.is_configured:
            return (
                "web search is not set up on this worker — EXA_API_KEY is "
                "missing."
            )
        return await self._exa.search(query)


# ---------------------------------------------------------------------------
# Session builder — used both by the worker entrypoint and unit tests
# ---------------------------------------------------------------------------


def _require_plugin(name: str, mod: Any) -> Any:
    if mod is None:
        raise RuntimeError(
            f"livekit.plugins.{name} is not installed. Install with "
            f"`pip install -e .[dev]` from services/livekit-agent (this pulls "
            f"livekit-agents[google,tavus])."
        )
    return mod


def build_agent_session() -> AgentSession:
    """Construct a fresh AgentSession with Gemini Live as the realtime LLM.

    Returns the session BEFORE the Tavus avatar is attached. The caller is
    expected to:

        avatar = build_avatar()
        await avatar.start(session, room=ctx.room)
        await session.start(agent=NexusAgent(...), room=ctx.room)
    """
    google = _require_plugin("google", _google)
    return AgentSession(
        llm=google.beta.realtime.RealtimeModel(
            model=DEFAULT_MODEL,
            voice=DEFAULT_VOICE,
            temperature=0.7,
            instructions=SYSTEM_INSTRUCTIONS,
        ),
    )


def build_avatar() -> Any:
    """Construct a tavus.AvatarSession from env. Returns the avatar handle."""
    tavus = _require_plugin("tavus", _tavus)
    replica_id = os.environ.get("TAVUS_REPLICA_ID")
    persona_id = os.environ.get("TAVUS_PERSONA_ID")
    if not replica_id or not persona_id:
        raise RuntimeError(
            "TAVUS_REPLICA_ID and TAVUS_PERSONA_ID must both be set. See "
            "services/livekit-agent/.env.example."
        )
    return tavus.AvatarSession(
        replica_id=replica_id,
        persona_id=persona_id,
        avatar_participant_name="Tavus-avatar-agent",
    )


# ---------------------------------------------------------------------------
# State forwarding
# ---------------------------------------------------------------------------


# Map AgentSession internal states to the StatusBadge contract. "initializing"
# and "idle" both surface as "idle" in the UI; once the agent's first
# listening/thinking/speaking transition lands, the badge animates.
_STATE_MAP: dict[str, str] = {
    "initializing": "idle",
    "idle": "idle",
    "listening": "listening",
    "thinking": "thinking",
    "speaking": "speaking",
}


def attach_state_forwarder(
    session: AgentSession,
    *,
    client: OrchestratorClient,
    session_id: str | None,
    livekit_room: str | None,
) -> None:
    """Wire AgentSession lifecycle events to OrchestratorClient.update_avatar_state."""

    @session.on("agent_state_changed")  # type: ignore[misc]
    def _on_agent_state(ev: AgentStateChangedEvent) -> None:
        ui_state = _STATE_MAP.get(ev.new_state, "idle")
        logger.info("agent_state_changed: %s → %s", ev.new_state, ui_state)
        # AgentSession event handlers are sync but the http call is async —
        # schedule on the running loop.
        import asyncio

        loop = asyncio.get_running_loop()
        loop.create_task(
            client.update_avatar_state(
                session_id=session_id,
                avatar_state=ui_state,
                livekit_room=livekit_room,
            )
        )

    @session.on("user_state_changed")  # type: ignore[misc]
    def _on_user_state(ev: Any) -> None:
        # When the user starts speaking while we're mid-sentence, force the
        # avatar into "listening" optimistically so the UI doesn't show
        # "speaking" for the 200-300ms it takes Gemini to ack the cancel.
        if getattr(ev, "new_state", None) == "speaking":
            import asyncio

            loop = asyncio.get_running_loop()
            loop.create_task(
                client.update_avatar_state(
                    session_id=session_id,
                    avatar_state="listening",
                    livekit_room=livekit_room,
                )
            )

    @session.on("user_interruption_detected")  # type: ignore[misc]
    def _on_interrupt(ev: Any) -> None:  # noqa: ARG001
        logger.info("user_interruption_detected — calling session.interrupt()")
        # Defensive: ask the session to drop in-flight TTS immediately. The
        # realtime model usually does this itself, but Tavus's downstream
        # audio pipeline benefits from the explicit cancel.
        try:
            session.interrupt()
        except Exception as e:  # pragma: no cover
            logger.warning("session.interrupt() raised: %s", e)


# ---------------------------------------------------------------------------
# Top-level entrypoint, called from worker.py
# ---------------------------------------------------------------------------


async def entrypoint(ctx: JobContext) -> None:
    """JobContext entrypoint registered by the worker.

    Reads sessionId + livekitRoom from the first remote participant's
    metadata (the orchestrator stamps it into the JWT before the browser
    joins the room). Bootstraps Gemini + Tavus, wires state forwarding,
    registers Phase 4 tools, and starts the session.
    """
    import json

    room_name: str | None = ctx.room.name if getattr(ctx, "room", None) else None
    session_id: str | None = None

    # First check the job's metadata in case we end up using RoomAgentDispatch
    # again (older livekit servers will tolerate it). Then fall back to the
    # browser participant's metadata.
    raw_meta = getattr(ctx.job, "metadata", "") if hasattr(ctx, "job") else ""
    if raw_meta:
        try:
            session_id = json.loads(raw_meta).get("sessionId")
        except json.JSONDecodeError:
            logger.warning("Job metadata was not JSON: %r", raw_meta)

    if not session_id:
        # Wait briefly for the browser to join, then read its metadata.
        try:
            participant = await ctx.wait_for_participant()
            if participant.metadata:
                try:
                    session_id = json.loads(participant.metadata).get("sessionId")
                except json.JSONDecodeError:
                    logger.warning(
                        "Participant metadata was not JSON: %r", participant.metadata
                    )
        except Exception as e:
            logger.warning("wait_for_participant failed: %s", e)

    logger.info(
        "Nexus agent entrypoint — room=%s sessionId=%s", room_name, session_id
    )

    client = OrchestratorClient()
    exa = ExaClient()
    if not exa.is_configured:
        logger.warning(
            "EXA_API_KEY is not set — web_search tool will return a "
            "graceful 'not configured' message instead of searching."
        )

    # Phase 4.3: callback used by NexusAgent.start_build to write the resolved
    # sessionId onto the agent's local participant attributes. The frontend
    # subscribes to participant attribute changes via livekit-client and uses
    # the value as the Convex selector for the right-panel queries.
    async def _publish_session_id(sid: str) -> None:
        if not getattr(ctx, "room", None) or not ctx.room.local_participant:
            return
        try:
            await ctx.room.local_participant.set_attributes({"sessionId": sid})
            logger.info("published sessionId=%s on local_participant attrs", sid)
        except Exception as e:  # pragma: no cover — older SDK paths
            logger.warning(
                "set_attributes failed (%s) — falling back to set_metadata", e
            )
            try:
                await ctx.room.local_participant.set_metadata(
                    json.dumps({"sessionId": sid})
                )
            except Exception as e2:
                logger.warning("set_metadata fallback also failed: %s", e2)

    try:
        session = build_agent_session()
        attach_state_forwarder(
            session, client=client, session_id=session_id, livekit_room=room_name
        )

        # Phase 4.8 — Tavus offline → audio-only fallback. Don't fatal-out
        # the whole worker; log and proceed without the avatar.
        try:
            avatar = build_avatar()
            await avatar.start(session, room=ctx.room)
        except Exception as e:
            logger.warning(
                "Tavus avatar failed to start (%s) — falling back to audio-only", e
            )

        # Build fal.ai tools — they need a sessionId, which is resolved above.
        # Use a mutable holder so the lambda always sees the freshest sid even
        # after start_build mutates NexusAgent._session_id.
        from .tools.fal_tools import make_fal_tools

        agent_holder: dict[str, Any] = {}
        fal_tools = make_fal_tools(
            client,
            lambda: getattr(agent_holder.get("agent"), "_session_id", session_id),
        )

        agent = NexusAgent(
            client=client,
            exa=exa,
            session_id=session_id,
            on_session_resolved=_publish_session_id,
            tools=fal_tools,
        )
        agent_holder["agent"] = agent
        await session.start(agent=agent, room=ctx.room)

        # Phase 4.5: register the live AgentSession with the narration server
        # so the orchestrator's HTTP narration POSTs can call session.say().
        # If we didn't yet have a session_id (voice-only boot), register on
        # the first start_build via the on_session_resolved callback above.
        if session_id:
            register_narration_session(session_id, session)
            await _publish_session_id(session_id)

        # Eagerly mark "listening" so the UI doesn't dwell on "idle" while the
        # realtime LLM is bootstrapping.
        await client.update_avatar_state(
            session_id=session_id,
            avatar_state="listening",
            livekit_room=room_name,
        )

        # Greet the user. generate_reply produces audio + state transitions.
        session.generate_reply(
            instructions=(
                "Greet the user warmly in one short sentence and ask what "
                "they want to build."
            )
        )

        async def _on_shutdown() -> None:
            if session_id:
                unregister_narration_session(session_id)
            await client.aclose()
            await exa.aclose()
            await shutdown_narration_server()

        ctx.add_shutdown_callback(_on_shutdown)
    except Exception:
        if session_id:
            unregister_narration_session(session_id)
        await client.aclose()
        await exa.aclose()
        raise
