"""The chat loop: send the history, run any tools the model asks for, and repeat until it answers."""

from __future__ import annotations

from typing import Any, Callable

from .providers import Provider, ToolCall, Turn
from .tools import Tool, validate_arguments


class AgentError(Exception):
    pass


def execute(call: ToolCall, tools: dict[str, Tool]) -> dict[str, Any]:
    """Runs one tool call and returns a result record. A failure becomes an error result the model can read."""
    def result(content: str, is_error: bool) -> dict[str, Any]:
        return {"id": call.id, "name": call.name, "content": content, "is_error": is_error}

    if call.error:
        return result(call.error, True)
    tool = tools.get(call.name)
    if tool is None:
        return result(f"Unknown tool {call.name!r}.", True)
    problem = validate_arguments(tool.spec.parameters, call.arguments)
    if problem:
        return result(problem, True)
    try:
        output = str(tool.run(**call.arguments))
    except Exception as error:  # a broken tool must not end the conversation
        return result(f"{type(error).__name__}: {error}", True)
    return result(output, output.startswith("Error:"))


def run_turn(
    provider: Provider, history: list[dict[str, Any]], user_text: str, tools: list[Tool] | None = None, *,
    system: str | None = None, on_text: Callable[[str], None] = lambda _text: None,
    on_tool: Callable[[ToolCall], None] = lambda _call: None, max_steps: int = 8,
) -> Turn:
    """Adds `user_text` to `history` and runs the model until it stops asking for tools."""
    by_name = {tool.spec.name: tool for tool in tools or []}
    specs = [tool.spec for tool in tools or []]
    history.append({"role": "user", "text": user_text})
    for _ in range(max_steps):
        turn = provider.stream_turn(system, history, specs, on_text)
        history.append({
            "role": "assistant", "text": turn.text, "tool_calls": turn.tool_calls,
            "native": turn.native, "provider": turn.provider,
        })
        if turn.stop_reason != "tool_use" or not turn.tool_calls:
            return turn
        results = []
        for call in turn.tool_calls:
            on_tool(call)
            results.append(execute(call, by_name))
        history.append({"role": "tool", "results": results})
    raise AgentError(f"The model kept calling tools for {max_steps} steps. Ask again or raise max_steps.")
