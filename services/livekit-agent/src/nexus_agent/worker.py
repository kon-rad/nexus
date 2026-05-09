"""LiveKit Agents worker entrypoint.

`nexus-agent dev` registers this worker against the LiveKit server using the
credentials in the local .env. Each room dispatched to this worker (by name —
see LIVEKIT_AGENT_NAME) runs the entrypoint in agent.py.

Local run:

    cd services/livekit-agent
    source .venv/bin/activate
    nexus-agent dev

Smoke test (kills server-side tail-pipe issues fast):

    nexus-agent connect --room nexus-test
"""

from __future__ import annotations

import logging
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from livekit.agents import WorkerOptions, cli

from .agent import entrypoint


def _bootstrap_logging() -> None:
    level = os.environ.get("LOG_LEVEL", "INFO").upper()
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)-7s %(name)s :: %(message)s",
    )


def _bootstrap_env() -> None:
    """Load env from services/livekit-agent/.env if present."""
    env_path = Path(__file__).resolve().parent.parent.parent / ".env"
    if env_path.exists():
        load_dotenv(env_path)
    # Also try the orchestrator's .env so we share LIVEKIT_* without copy-paste.
    orch_env = (
        Path(__file__).resolve().parent.parent.parent.parent.parent
        / "apps"
        / "orchestrator"
        / ".env"
    )
    if orch_env.exists():
        load_dotenv(orch_env, override=False)


def main() -> None:
    _bootstrap_env()
    _bootstrap_logging()

    # Default to explicit-dispatch mode with the same name the orchestrator
    # uses (apps/orchestrator/src/livekit.ts → "nexus-voice-agent"). This
    # ensures the worker only joins rooms the orchestrator's
    # AgentDispatchClient.createDispatch points it at — preventing the
    # double-dispatch bug where an empty agent_name caused the worker to
    # auto-join every room AND get an explicit dispatch on top, which spent
    # twice the Gemini Live quota.
    #
    # If a deployment needs to fall back to the Phase 3 auto-join behavior
    # (older livekit-server that rejects RoomAgentDispatch.deployment),
    # set LIVEKIT_AGENT_NAME="" explicitly in the env.
    agent_name = os.environ.get("LIVEKIT_AGENT_NAME", "nexus-voice-agent")

    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            agent_name=agent_name,
        )
    )


if __name__ == "__main__":  # pragma: no cover
    main()
    sys.exit(0)
