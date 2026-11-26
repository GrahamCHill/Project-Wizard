"""Provider adapters.

Every adapter streams one assistant turn and returns it in a neutral form, so the chat loop in
agent.py never needs to know which API is behind it.

* Claude uses the official Anthropic SDK.
* Groq uses the official Groq SDK.
* Everything else that speaks the OpenAI chat completions protocol (OpenAI, Together, Mistral,
  OpenRouter, DeepSeek, xAI, Gemini, Ollama, LM Studio, vLLM, ...) uses the OpenAI SDK with a base URL.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from typing import Any, Callable, Mapping

# --- Neutral types --------------------------------------------------------------------------------------


@dataclass(frozen=True)
class ToolSpec:
    """A tool the model may call. `parameters` is a JSON Schema object."""

    name: str
    description: str
    parameters: dict[str, Any]


@dataclass
class ToolCall:
    id: str
    name: str
    arguments: dict[str, Any]
    # Set when the model sent arguments that were not valid JSON, so the loop can tell it so.
    error: str | None = None


@dataclass
class Turn:
    """One assistant turn: text, requested tool calls, and why the model stopped."""

    text: str = ""
    tool_calls: list[ToolCall] = field(default_factory=list)
    # end_turn, tool_use, max_tokens, refusal, or other
    stop_reason: str = "end_turn"
    provider: str = ""
    model: str = ""
    # The provider's own assistant message. Claude needs its thinking blocks sent back unchanged.
    native: Any = None
    detail: str = ""


class ConfigError(Exception):
    """The provider is not configured, for example because an API key is missing."""


class Provider:
    """Streams one assistant turn."""

    name = "provider"
    model = ""

    def stream_turn(
        self, system: str | None, history: list[dict[str, Any]], tools: list[ToolSpec],
        on_text: Callable[[str], None],
    ) -> Turn:
        raise NotImplementedError


# --- Claude (Anthropic SDK) ----------------------------------------------------------------------------

DEFAULT_CLAUDE_MODEL = "claude-opus-5-5"
FALLBACK_BETA = "server-side-fallback-2026-07-01"


class AnthropicProvider(Provider):
    name = "anthropic"

    def __init__(
        self, model: str = DEFAULT_CLAUDE_MODEL, *, api_key: str | None = None, base_url: str | None = None,
        max_tokens: int = 64000, effort: str | None = None, thinking: bool = True, fallbacks: bool = True,
        client: Any = None,
    ) -> None:
        if client is None:
            from anthropic import Anthropic

            # With no key, the SDK reads ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN, or an `ant auth login` profile.
            client = Anthropic(api_key=api_key, base_url=base_url)
        self.client = client
        self.model = model
        self.max_tokens = max_tokens
        self.effort = effort
        self.thinking = thinking
        self.fallbacks = fallbacks

    @staticmethod
    def messages(history: list[dict[str, Any]]) -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = []
        for item in history:
            if item["role"] == "user":
                out.append({"role": "user", "content": item["text"]})
            elif item["role"] == "assistant":
                if item.get("provider") == "anthropic" and item.get("native") is not None:
                    # Send the blocks back exactly as received, including any thinking blocks.
                    out.append({"role": "assistant", "content": item["native"]})
                else:
                    blocks: list[dict[str, Any]] = []
                    if item["text"]:
                        blocks.append({"type": "text", "text": item["text"]})
                    for call in item["tool_calls"]:
                        blocks.append({"type": "tool_use", "id": call.id, "name": call.name, "input": call.arguments})
                    out.append({"role": "assistant", "content": blocks})
            else:  # tool results go back in a single user message
                out.append({"role": "user", "content": [
                    {"type": "tool_result", "tool_use_id": r["id"], "content": r["content"], "is_error": r["is_error"]}
                    for r in item["results"]
                ]})
        return out

    def request(self, system: str | None, history: list[dict[str, Any]], tools: list[ToolSpec]) -> dict[str, Any]:
        params: dict[str, Any] = {"model": self.model, "max_tokens": self.max_tokens, "messages": self.messages(history)}
        if system:
            params["system"] = system
        if self.thinking:
            params["thinking"] = {"type": "adaptive"}
        if self.effort:
            params["output_config"] = {"effort": self.effort}
        if tools:
            # eager_input_streaming streams large tool inputs as they are generated. The API then no longer
            # validates them, which is why the agent loop checks every input before it runs a tool.
            params["tools"] = [
                {"name": t.name, "description": t.description, "input_schema": t.parameters, "eager_input_streaming": True}
                for t in tools
            ]
        return params

    def stream_turn(self, system, history, tools, on_text):
        params = self.request(system, history, tools)
        if self.fallbacks:
            # Lets the API retry on another model if a safety classifier declines the request.
            stream_api = self.client.beta.messages.stream
            params["betas"] = [FALLBACK_BETA]
            params["fallbacks"] = "default"
        else:
            stream_api = self.client.messages.stream
        retries = 0
        while True:
            try:
                with stream_api(**params) as stream:
                    for text in stream.text_stream:
                        on_text(text)
                    message = stream.get_final_message()
                break
            except ValueError:
                # Tool input the SDK could not parse at all. Re-issue the turn a couple of times.
                retries += 1
                if retries > 2:
                    raise
        calls = [
            ToolCall(id=block.id, name=block.name, arguments=block.input if isinstance(block.input, dict) else {},
                     error=None if isinstance(block.input, dict) else "Tool input was not a JSON object.")
            for block in message.content if block.type == "tool_use"
        ]
        reasons = {"end_turn": "end_turn", "tool_use": "tool_use", "max_tokens": "max_tokens", "refusal": "refusal"}
        detail = ""
        if message.stop_reason == "refusal":
            details = getattr(message, "stop_details", None)
            detail = (getattr(details, "category", None) or "") if details else ""
        return Turn(
            text="".join(block.text for block in message.content if block.type == "text"),
            tool_calls=calls, stop_reason=reasons.get(message.stop_reason or "", "other"), provider=self.name,
            model=message.model, native=message.content, detail=detail,
        )


# --- Chat completions (Groq SDK and OpenAI SDK) --------------------------------------------------------


def _to_chat_messages(system: str | None, history: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = [{"role": "system", "content": system}] if system else []
    for item in history:
        if item["role"] == "user":
            out.append({"role": "user", "content": item["text"]})
        elif item["role"] == "assistant":
            message: dict[str, Any] = {"role": "assistant", "content": item["text"] or None}
            if item["tool_calls"]:
                message["tool_calls"] = [
                    {"id": c.id, "type": "function", "function": {"name": c.name, "arguments": json.dumps(c.arguments)}}
                    for c in item["tool_calls"]
                ]
            out.append(message)
        else:
            for result in item["results"]:
                prefix = "Error: " if result["is_error"] else ""
                out.append({"role": "tool", "tool_call_id": result["id"], "content": prefix + result["content"]})
    return out


def _parse_arguments(raw: str) -> tuple[dict[str, Any], str | None]:
    try:
        value = json.loads(raw or "{}")
    except json.JSONDecodeError as error:
        return {}, f"Tool arguments were not valid JSON: {error.msg}."
    if not isinstance(value, dict):
        return {}, "Tool arguments were not a JSON object."
    return value, None


class ChatCompletionsProvider(Provider):
    """Works with any client that exposes `client.chat.completions.create(..., stream=True)`."""

    def __init__(self, name: str, client: Any, model: str, *, max_tokens: int = 4096,
                 max_tokens_param: str = "max_tokens") -> None:
        self.name = name
        self.client = client
        self.model = model
        self.max_tokens = max_tokens
        self.max_tokens_param = max_tokens_param

    def stream_turn(self, system, history, tools, on_text):
        params: dict[str, Any] = {
            "model": self.model, "messages": _to_chat_messages(system, history), "stream": True,
            self.max_tokens_param: self.max_tokens,
        }
        if tools:
            params["tools"] = [
                {"type": "function", "function": {"name": t.name, "description": t.description, "parameters": t.parameters}}
                for t in tools
            ]
        text: list[str] = []
        slots: dict[Any, dict[str, str]] = {}
        finish = None
        for chunk in self.client.chat.completions.create(**params):
            if not chunk.choices:
                continue
            choice = chunk.choices[0]
            delta = choice.delta
            if delta is not None and delta.content:
                text.append(delta.content)
                on_text(delta.content)
            for part in (delta.tool_calls if delta is not None and delta.tool_calls else []):
                # Servers number tool calls with `index`. A few send whole calls without one.
                key = part.index if part.index is not None else part.id or len(slots)
                slot = slots.setdefault(key, {"id": "", "name": "", "arguments": ""})
                slot["id"] = part.id or slot["id"]
                if part.function is not None:
                    slot["name"] = part.function.name or slot["name"]
                    slot["arguments"] += part.function.arguments or ""
            finish = choice.finish_reason or finish
        calls = []
        for position, slot in enumerate(slots.values()):
            arguments, error = _parse_arguments(slot["arguments"])
            calls.append(ToolCall(id=slot["id"] or f"call_{position}", name=slot["name"], arguments=arguments, error=error))
        reasons = {"stop": "end_turn", "tool_calls": "tool_use", "length": "max_tokens", "content_filter": "refusal"}
        stop = "tool_use" if calls else reasons.get(finish or "", "end_turn" if finish is None else "other")
        return Turn(text="".join(text), tool_calls=calls, stop_reason=stop, provider=self.name, model=self.model)


# --- Presets and construction --------------------------------------------------------------------------


@dataclass(frozen=True)
class Preset:
    kind: str  # anthropic, groq, or openai
    key_env: str = ""
    base_url: str = ""
    default_model: str = ""
    key_required: bool = True
    max_tokens_param: str = "max_tokens"
    note: str = ""


# Base URLs and variable names come from each provider's documentation. Check them if a request fails.
PRESETS: dict[str, Preset] = {
    "anthropic": Preset("anthropic", "ANTHROPIC_API_KEY", default_model=DEFAULT_CLAUDE_MODEL, key_required=False,
                        note="Claude. Also accepts ANTHROPIC_AUTH_TOKEN or an `ant auth login` profile."),
    "groq": Preset("groq", "GROQ_API_KEY", default_model="llama-3.3-70b-versatile", max_tokens_param="max_completion_tokens",
                   note="Groq's own SDK. Run `--list-models` to see the models your key can use."),
    "openai": Preset("openai", "OPENAI_API_KEY", "https://api.openai.com/v1", max_tokens_param="max_completion_tokens"),
    "together": Preset("openai", "TOGETHER_API_KEY", "https://api.together.xyz/v1"),
    "mistral": Preset("openai", "MISTRAL_API_KEY", "https://api.mistral.ai/v1"),
    "openrouter": Preset("openai", "OPENROUTER_API_KEY", "https://openrouter.ai/api/v1"),
    "deepseek": Preset("openai", "DEEPSEEK_API_KEY", "https://api.deepseek.com"),
    "xai": Preset("openai", "XAI_API_KEY", "https://api.x.ai/v1"),
    "gemini": Preset("openai", "GEMINI_API_KEY", "https://generativelanguage.googleapis.com/v1beta/openai/"),
    "ollama": Preset("openai", "", "http://localhost:11434/v1", key_required=False, note="Local. Start Ollama first."),
    "lmstudio": Preset("openai", "", "http://localhost:1234/v1", key_required=False, note="Local. Start the LM Studio server."),
    "custom": Preset("openai", "LLM_API_KEY", "", key_required=False,
                     note="Any OpenAI-compatible server. Set LLM_BASE_URL, and LLM_API_KEY if it needs one."),
}


def _number(env: Mapping[str, str], name: str, default: int) -> int:
    value = env.get(name, "").strip()
    if not value:
        return default
    try:
        return int(value)
    except ValueError:
        raise ConfigError(f"{name} must be a whole number, not {value!r}.") from None


def make_provider(
    name: str, model: str | None = None, *, base_url: str | None = None, env: Mapping[str, str] | None = None,
    client: Any = None,
) -> Provider:
    """Builds the adapter for a preset name. Pass `client` to substitute the SDK client, for example in tests."""
    env = os.environ if env is None else env
    preset = PRESETS.get(name)
    if preset is None:
        raise ConfigError(f"Unknown provider {name!r}. Choose one of: {', '.join(PRESETS)}.")
    key = env.get(preset.key_env, "").strip() if preset.key_env else ""
    chosen_model = model or env.get("LLM_MODEL", "").strip() or preset.default_model
    url = base_url or env.get("LLM_BASE_URL", "").strip() or preset.base_url
    if preset.kind == "anthropic":
        return AnthropicProvider(
            chosen_model, api_key=key or None, base_url=env.get("ANTHROPIC_BASE_URL") or base_url,
            max_tokens=_number(env, "LLM_MAX_TOKENS", 64000), effort=env.get("ANTHROPIC_EFFORT", "").strip() or None,
            thinking=env.get("ANTHROPIC_THINKING", "adaptive").strip().lower() != "off",
            fallbacks=env.get("ANTHROPIC_FALLBACKS", "default").strip().lower() != "off", client=client,
        )
    if preset.key_required and not key and client is None:
        raise ConfigError(f"Set {preset.key_env} to use {name}.")
    if not chosen_model:
        raise ConfigError(f"Choose a model for {name} with --model or LLM_MODEL.")
    if name == "custom" and not url:
        raise ConfigError("Set LLM_BASE_URL (or pass --base-url) for the custom provider.")
    max_tokens = _number(env, "LLM_MAX_TOKENS", 4096)
    if preset.kind == "groq":
        if client is None:
            from groq import Groq

            client = Groq(api_key=key, base_url=base_url or env.get("GROQ_BASE_URL") or None)
    elif client is None:
        from openai import OpenAI

        # Local servers ignore the key, but the SDK insists on a non-empty one.
        client = OpenAI(api_key=key or "not-needed", base_url=url)
    return ChatCompletionsProvider(name, client, chosen_model, max_tokens=max_tokens, max_tokens_param=preset.max_tokens_param)
