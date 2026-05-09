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

    # Phase 3 dev: leave agent_name unset by default so the worker auto-joins
    # every room. This avoids the livekit-server v1.11.x JWT JSON-parse
    # incompatibility with `RoomAgentDispatch.deployment` from
    # livekit-server-sdk 2.15.x. Set LIVEKIT_AGENT_NAME explicitly to opt
    # into per-session explicit dispatch (Phase 4 territory).
    agent_name = os.environ.get("LIVEKIT_AGENT_NAME", "")

    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            agent_name=agent_name,
        )
    )


if __name__ == "__main__":  # pragma: no cover
    main()
    sys.exit(0)
