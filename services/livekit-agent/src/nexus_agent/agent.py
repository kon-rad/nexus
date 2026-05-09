"""Nexus voice agent: Gemini Live + Tavus BYO + Convex-mirrored state.

The agent is a thin wrapper around livekit.agents.AgentSession:

- LLM:    livekit.plugins.google.beta.realtime.RealtimeModel  (Gemini Live)
- Avatar: livekit.plugins.tavus.AvatarSession                 (BYO LLM mode)

The audio output of the realtime model is automatically subscribed to by the
avatar plugin (per livekit.docs > Virtual avatar models > Usage), so we don't
manually wire any audio pipes — `AvatarSession.start(session, room)` does it.

The agent listens to AgentSession lifecycle events and forwards each transition
to the orchestrator over HTTP, which mirrors them to Convex
(`sessions.avatarState`). The browser's `useQuery` updates the StatusBadge.
"""

from __future__ import annotations

import logging
import os
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


# ---- Configuration ---------------------------------------------------------
SYSTEM_INSTRUCTIONS = (
    "You are Nexus, a senior pair programmer on a video call with the user. "
    "Listen to what they want to build. Phase 3: chat naturally and answer "
    "design questions. DO NOT call any code-generation tools yet — they land "
    "in Phase 4. Keep responses tight: one or two sentences before the user "
    "speaks again. Speak with warm confidence, like a friend who happens to "
    "be the best engineer you know."
)

# Default Gemini Live model + voice. Overridable via env for cost tuning.
DEFAULT_MODEL = os.environ.get("GEMINI_REALTIME_MODEL", "gemini-2.5-flash-preview-native-audio-dialog")
DEFAULT_VOICE = os.environ.get("GEMINI_REALTIME_VOICE", "Puck")


# ---------------------------------------------------------------------------
# Agent class
# ---------------------------------------------------------------------------


class NexusAgent(Agent):
    """The voice persona. Phase 3 only chats. Phase 4 adds start_build()."""

    def __init__(self) -> None:
        super().__init__(instructions=SYSTEM_INSTRUCTIONS)

    @function_tool()
    async def chat_status(self, context: RunContext, status: str) -> str:
        """Acknowledge an internal status. Phase 3 placeholder.

        Args:
            status: Free-text label, e.g. "ready" / "thinking" / "stuck".

        Phase 4 will replace this with start_build(intent: str). The function
        signature is preserved so we can swap implementations without churning
        the system prompt.
        """
        logger.info("chat_status: %s", status)
        return f"acknowledged: {status}"


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
        await session.start(agent=NexusAgent(), room=ctx.room)
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
    and starts the session.
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
    try:
        session = build_agent_session()
        attach_state_forwarder(
            session, client=client, session_id=session_id, livekit_room=room_name
        )

        # Avatar must start before session.start() so its participant is in the
        # room and ready to subscribe to the agent's audio output.
        avatar = build_avatar()
        await avatar.start(session, room=ctx.room)

        await session.start(agent=NexusAgent(), room=ctx.room)

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

        # Block until the participant leaves. The AgentSession keeps running
        # in background tasks; we just need to keep the entrypoint alive so
        # the agent's connection isn't torn down by the worker.
        # JobContext exposes a shutdown coroutine that resolves when the room
        # closes or the worker drains.
        ctx.add_shutdown_callback(client.aclose)
    except Exception:
        await client.aclose()
        raise
