"""Command line chat. Run `__PROJECT_SLUG__ --help` for the options."""

from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Sequence

from .agent import AgentError, run_turn
from .providers import PRESETS, ConfigError, Provider, ToolCall, make_provider
from .tools import default_tools

SYSTEM = "You are a concise, helpful assistant. Use the tools when they help, and say when you are unsure."


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="__PROJECT_SLUG__", description="Chat with Claude, Groq, or any OpenAI-compatible model.")
    parser.add_argument("prompt", nargs="*", help="Ask one question and exit. Without it, start an interactive chat.")
    parser.add_argument("-p", "--provider", default=os.environ.get("LLM_PROVIDER", "anthropic"),
                        help="One of: " + ", ".join(PRESETS) + " (default: anthropic, or $LLM_PROVIDER)")
    parser.add_argument("-m", "--model", help="Model name (default: the provider's default, or $LLM_MODEL)")
    parser.add_argument("--base-url", help="Override the provider's API base URL")
    parser.add_argument("--system", default=SYSTEM, help="System prompt")
    parser.add_argument("--no-tools", action="store_true", help="Do not offer the example tools")
    parser.add_argument("--list-providers", action="store_true", help="Show the providers and what each needs, then exit")
    parser.add_argument("--list-models", action="store_true", help="List the models the provider offers, then exit")
    return parser


def describe_providers() -> str:
    lines = []
    for name, preset in PRESETS.items():
        needs = preset.key_env or "no key"
        if name == "custom":
            needs = "LLM_BASE_URL and LLM_API_KEY"
        lines.append(f"{name:<11} {needs:<30} {preset.note}".rstrip())
    return "\n".join(lines)


def list_models(provider: Provider) -> list[str]:
    models = provider.client.models.list()  # every SDK used here has the same call
    return sorted(model.id for model in getattr(models, "data", models))


def show_tool(call: ToolCall) -> None:
    print(f"  [tool] {call.name}({json.dumps(call.arguments)})", file=sys.stderr)


def ask(provider: Provider, history: list, text: str, args: argparse.Namespace) -> None:
    turn = run_turn(provider, history, text, [] if args.no_tools else default_tools(), system=args.system,
                    on_text=lambda chunk: print(chunk, end="", flush=True), on_tool=show_tool)
    print()
    if turn.stop_reason == "refusal":
        print(f"[The model declined this request{': ' + turn.detail if turn.detail else ''}.]", file=sys.stderr)
    elif turn.stop_reason == "max_tokens":
        print("[The answer was cut off. Raise LLM_MAX_TOKENS to allow a longer one.]", file=sys.stderr)


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if args.list_providers:
        print(describe_providers())
        return 0
    try:
        provider = make_provider(args.provider, args.model, base_url=args.base_url)
        if args.list_models:
            print("\n".join(list_models(provider)))
            return 0
        history: list = []
        if args.prompt:
            ask(provider, history, " ".join(args.prompt), args)
            return 0
        print(f"Chatting with {provider.name} ({provider.model}). Type /reset to start over or /exit to quit.", file=sys.stderr)
        while True:
            try:
                text = input("you> ").strip()
            except (EOFError, KeyboardInterrupt):
                print()
                return 0
            if text in ("/exit", "/quit"):
                return 0
            if text == "/reset":
                history.clear()
                continue
            if text:
                ask(provider, history, text, args)
    except (ConfigError, AgentError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 2
    except Exception as error:  # the SDKs raise their own typed errors, for example for a bad key or a rate limit
        print(f"error: {type(error).__name__}: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
