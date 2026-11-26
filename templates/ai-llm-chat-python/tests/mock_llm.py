"""A local server that speaks the streaming protocols of Anthropic and of OpenAI-style APIs.

The tests point the real SDKs at it, so they check the requests the SDKs send and how they parse a
streamed reply, without a network or an API key. Queue replies with `server.reply(...)`, then read the
requests the SDK made from `server.requests`.
"""

from __future__ import annotations

import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any


def _sse(events: list[tuple[str | None, dict[str, Any] | str]]) -> bytes:
    out = []
    for name, data in events:
        payload = data if isinstance(data, str) else json.dumps(data)
        out.append((f"event: {name}\n" if name else "") + f"data: {payload}\n\n")
    return "".join(out).encode()


def anthropic_reply(text: str = "", tool_calls: list[tuple[str, str, dict]] | None = None, stop: str = "end_turn",
                    stop_details: dict | None = None, model: str = "claude-opus-5-5") -> bytes:
    """A streamed Messages API reply with optional text and tool_use blocks."""
    events: list[tuple[str | None, dict | str]] = [("message_start", {"type": "message_start", "message": {
        "id": "msg_1", "type": "message", "role": "assistant", "model": model, "content": [], "stop_reason": None,
        "stop_sequence": None, "usage": {"input_tokens": 10, "output_tokens": 1}}})]
    index = 0
    if text:
        events.append(("content_block_start", {"type": "content_block_start", "index": index,
                                               "content_block": {"type": "text", "text": ""}}))
        for piece in (text[: len(text) // 2], text[len(text) // 2:]):
            events.append(("content_block_delta", {"type": "content_block_delta", "index": index,
                                                   "delta": {"type": "text_delta", "text": piece}}))
        events.append(("content_block_stop", {"type": "content_block_stop", "index": index}))
        index += 1
    for call_id, name, arguments in tool_calls or []:
        raw = arguments if isinstance(arguments, str) else json.dumps(arguments)
        events.append(("content_block_start", {"type": "content_block_start", "index": index, "content_block": {
            "type": "tool_use", "id": call_id, "name": name, "input": {}}}))
        for piece in (raw[: len(raw) // 2], raw[len(raw) // 2:]):
            events.append(("content_block_delta", {"type": "content_block_delta", "index": index,
                                                   "delta": {"type": "input_json_delta", "partial_json": piece}}))
        events.append(("content_block_stop", {"type": "content_block_stop", "index": index}))
        index += 1
    delta: dict[str, Any] = {"stop_reason": stop, "stop_sequence": None}
    if stop_details:
        delta["stop_details"] = stop_details
    events.append(("message_delta", {"type": "message_delta", "delta": delta, "usage": {"output_tokens": 5}}))
    events.append(("message_stop", {"type": "message_stop"}))
    return _sse(events)


def chat_reply(text: str = "", tool_calls: list[tuple[str, str, str]] | None = None, finish: str | None = None,
               model: str = "test-model") -> bytes:
    """A streamed chat completions reply. Tool calls are (id, name, raw JSON arguments)."""
    def chunk(delta: dict, reason: str | None = None) -> tuple[None, dict]:
        return (None, {"id": "chatcmpl-1", "object": "chat.completion.chunk", "created": 1, "model": model,
                       "choices": [{"index": 0, "delta": delta, "finish_reason": reason}]})

    events = [chunk({"role": "assistant", "content": ""})]
    if text:
        events += [chunk({"content": text[: len(text) // 2]}), chunk({"content": text[len(text) // 2:]})]
    for position, (call_id, name, raw) in enumerate(tool_calls or []):
        events.append(chunk({"tool_calls": [{"index": position, "id": call_id, "type": "function",
                                             "function": {"name": name, "arguments": ""}}]}))
        for piece in (raw[: len(raw) // 2], raw[len(raw) // 2:]):
            events.append(chunk({"tool_calls": [{"index": position, "function": {"arguments": piece}}]}))
    events.append(chunk({}, finish or ("tool_calls" if tool_calls else "stop")))
    events.append((None, "[DONE]"))
    return _sse(events)


class MockServer:
    def __init__(self) -> None:
        self.requests: list[dict[str, Any]] = []
        self.replies: list[bytes | tuple[int, dict]] = []
        outer = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *_args: Any) -> None:  # keep test output quiet
                pass

            def _record(self) -> dict[str, Any]:
                length = int(self.headers.get("content-length") or 0)
                body = json.loads(self.rfile.read(length) or b"{}") if length else {}
                request = {"method": self.command, "path": self.path, "headers": {k.lower(): v for k, v in self.headers.items()},
                           "body": body}
                outer.requests.append(request)
                return request

            def do_GET(self) -> None:
                self._record()
                payload = json.dumps({"object": "list", "data": [{"id": "model-b", "object": "model", "type": "model",
                                                                   "display_name": "B", "created_at": "2026-01-01T00:00:00Z"},
                                                                  {"id": "model-a", "object": "model", "type": "model",
                                                                   "display_name": "A", "created_at": "2026-01-01T00:00:00Z"}],
                                      "has_more": False, "first_id": "model-b", "last_id": "model-a"}).encode()
                self.send_response(200)
                self.send_header("content-type", "application/json")
                self.send_header("content-length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)

            def do_POST(self) -> None:
                self._record()
                reply = outer.replies.pop(0) if outer.replies else b""
                if isinstance(reply, tuple):  # (status, json error body)
                    status, body = reply
                    payload = json.dumps(body).encode()
                    self.send_response(status)
                    self.send_header("content-type", "application/json")
                    self.send_header("content-length", str(len(payload)))
                    self.end_headers()
                    self.wfile.write(payload)
                    return
                self.send_response(200)
                self.send_header("content-type", "text/event-stream")
                self.send_header("content-length", str(len(reply)))
                self.end_headers()
                self.wfile.write(reply)

        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)

    @property
    def url(self) -> str:
        return f"http://127.0.0.1:{self.httpd.server_address[1]}"

    def reply(self, *replies: bytes | tuple[int, dict]) -> None:
        self.replies.extend(replies)

    def __enter__(self) -> "MockServer":
        self.thread.start()
        return self

    def __exit__(self, *_exc: Any) -> None:
        self.httpd.shutdown()
        self.httpd.server_close()
