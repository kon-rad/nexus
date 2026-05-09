"""fal.ai tools for the Nexus voice agent.

Two tools:

  list_fal_models(category?, query?)
      → string with up to 12 candidate models (id + display_name + 1-line description).
      The agent reads this back, picks the best match, then calls run_fal_model.

  run_fal_model(endpoint_id, prompt, extra_input?)
      → string acknowledgment. The actual job runs in the orchestrator and
      streams output into the Convex falJobs table; the Generate tab in the
      browser is what the user sees.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from livekit.agents import RunContext, function_tool

from ..orchestrator_client import OrchestratorClient

logger = logging.getLogger(__name__)


def make_fal_tools(client: OrchestratorClient, session_id_provider):
    """Build the two tools as bound async functions.

    Args:
        client: shared OrchestratorClient instance.
        session_id_provider: zero-arg callable returning the current Convex
            sessionId. We pass a callable (not the value) because the
            entrypoint resolves the sessionId after agent construction.
    """

    @function_tool()
    async def list_fal_models(
        context: RunContext,
        category: str | None = None,
        query: str | None = None,
    ) -> str:
        """Discover fal.ai models the agent can run.

        Args:
            category: Optional filter, e.g. "text-to-image", "image-to-video",
                "text-to-audio", "text-to-3d", "image-to-3d".
            query: Optional free-text match against name/description/tags.

        Returns:
            A JSON-encoded list of up to 12 candidates with endpoint_id,
            display_name, category, description, and tags.
        """
        models = await client.list_fal_models(category=category, query=query)
        # Cap to keep the realtime LLM context small.
        slim = [
            {
                "endpoint_id": m.get("endpoint_id"),
                "display_name": m.get("display_name"),
                "category": m.get("category"),
                "description": (m.get("description") or "")[:160],
                "tags": (m.get("tags") or [])[:5],
            }
            for m in models[:12]
        ]
        logger.info("list_fal_models → %d candidates", len(slim))
        return json.dumps(slim)

    @function_tool()
    async def run_fal_model(
        context: RunContext,
        endpoint_id: str,
        prompt: str,
        extra_input: dict[str, Any] | None = None,
    ) -> str:
        """Run a fal.ai model and surface the result in the Generate tab.

        Args:
            endpoint_id: The model's stable id, e.g. "fal-ai/flux/schnell" or
                "fal-ai/minimax/video-01". Always pick from list_fal_models()
                output — do not invent ids.
            prompt: Plain-language prompt describing what to generate. Most
                fal models accept `prompt` as their primary input.
            extra_input: Optional extra parameters specific to the model
                (e.g. {"image_url": "..."} for img2img). Keep this minimal.

        Returns:
            One short sentence the agent should narrate aloud while the job
            runs ("Generating now — should take about ten seconds…").
        """
        session_id = session_id_provider()
        if not session_id:
            return "I can't run a model yet — the session isn't ready."
        merged: dict[str, Any] = {"prompt": prompt}
        if extra_input:
            merged.update(extra_input)
        job_id = await client.run_fal_model(
            session_id=session_id,
            endpoint_id=endpoint_id,
            input=merged,
        )
        if not job_id:
            return "I couldn't reach the generation service. Please try again."
        return (
            f"Running {endpoint_id} now. The result will appear in the Generate tab "
            f"on the right panel as soon as it's ready."
        )

    return [list_fal_models, run_fal_model]
