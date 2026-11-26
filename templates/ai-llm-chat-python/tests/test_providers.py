"""Runs each provider adapter against the mock server, through the real vendor SDK."""

import unittest

from llm_chat import ConfigError, default_tools, make_provider, run_turn
from mock_llm import MockServer, anthropic_reply, chat_reply


def chat(provider, text, tools=True):
    history, streamed = [], []
    turn = run_turn(provider, history, text, default_tools() if tools else [], on_text=streamed.append)
    return turn, history, "".join(streamed)


class ClaudeTest(unittest.TestCase):
    def provider(self, server, **env):
        return make_provider("anthropic", env={"ANTHROPIC_API_KEY": "test-key", "ANTHROPIC_BASE_URL": server.url, **env})

    def test_streams_text_with_the_documented_request_shape(self):
        with MockServer() as server:
            server.reply(anthropic_reply("Hello there"))
            turn, _history, streamed = chat(self.provider(server), "Hi")
        self.assertEqual((turn.text, streamed, turn.stop_reason, turn.provider), ("Hello there", "Hello there", "end_turn", "anthropic"))
        request = server.requests[0]
        self.assertEqual(request["headers"]["authorization"], "Bearer test-key")
        body = request["body"]
        self.assertEqual(body["model"], "claude-opus-5-5")
        self.assertIs(body["stream"], True)
        self.assertEqual(body["thinking"], {"type": "adaptive"})
        self.assertEqual(body["messages"], [{"role": "user", "content": "Hi"}])
        self.assertEqual(body["max_tokens"], 64000)
        self.assertNotIn("temperature", body)

    def test_refusal_fallbacks_are_on_by_default_and_can_be_turned_off(self):
        with MockServer() as server:
            server.reply(anthropic_reply("a"), anthropic_reply("b"))
            chat(self.provider(server), "Hi")
            chat(self.provider(server, ANTHROPIC_FALLBACKS="off"), "Hi")
        enabled, disabled = server.requests
        self.assertIn("server-side-fallback-2026-07-01", enabled["headers"]["anthropic-beta"])
        self.assertEqual(enabled["body"]["fallbacks"], "default")
        self.assertNotIn("fallbacks", disabled["body"])
        self.assertNotIn("server-side-fallback", disabled["headers"].get("anthropic-beta", ""))

    def test_thinking_and_effort_follow_the_environment(self):
        with MockServer() as server:
            server.reply(anthropic_reply("ok"))
            chat(self.provider(server, ANTHROPIC_THINKING="off", ANTHROPIC_EFFORT="high", LLM_MAX_TOKENS="2000"), "Hi")
        body = server.requests[0]["body"]
        self.assertNotIn("thinking", body)
        self.assertEqual(body["output_config"], {"effort": "high"})
        self.assertEqual(body["max_tokens"], 2000)

    def test_runs_a_tool_and_sends_the_result_back_in_one_user_message(self):
        with MockServer() as server:
            server.reply(
                anthropic_reply("Let me check.", [("toolu_1", "calculate", {"expression": "6 * 7"}),
                                                  ("toolu_2", "calculate", {"expression": "2 ** 5"})], stop="tool_use"),
                anthropic_reply("42 and 32"),
            )
            turn, history, streamed = chat(self.provider(server), "6*7 and 2^5?")
        self.assertEqual(turn.text, "42 and 32")
        self.assertEqual(streamed, "Let me check.42 and 32")
        first, second = (r["body"] for r in server.requests)
        tool = first["tools"][0]
        self.assertEqual(tool["name"], "calculate")
        self.assertIs(tool["eager_input_streaming"], True)
        self.assertEqual(tool["input_schema"]["required"], ["expression"])
        assistant, results = second["messages"][1], second["messages"][2]
        self.assertEqual([b["type"] for b in assistant["content"]], ["text", "tool_use", "tool_use"])
        self.assertEqual(assistant["content"][1]["input"], {"expression": "6 * 7"})
        self.assertEqual(results["role"], "user")
        self.assertEqual([(b["tool_use_id"], b["content"], b["is_error"]) for b in results["content"]],
                         [("toolu_1", "42", False), ("toolu_2", "32", False)])
        self.assertEqual([m["role"] for m in history], ["user", "assistant", "tool", "assistant"])

    def test_a_tool_that_rejects_its_input_returns_an_error_result(self):
        with MockServer() as server:
            server.reply(anthropic_reply("", [("toolu_1", "calculate", {"expression": 5})], stop="tool_use"),
                         anthropic_reply("Sorry."))
            chat(self.provider(server), "x")
        result = server.requests[1]["body"]["messages"][2]["content"][0]
        self.assertIs(result["is_error"], True)
        self.assertIn("must be of type string", result["content"])

    def test_a_refusal_reports_its_category_and_runs_no_tools(self):
        with MockServer() as server:
            server.reply(anthropic_reply("", stop="refusal", stop_details={"type": "refusal", "category": "cyber", "explanation": None}))
            turn, history, _ = chat(self.provider(server), "x")
        self.assertEqual((turn.stop_reason, turn.detail), ("refusal", "cyber"))
        self.assertEqual(len(history), 2)

    def test_the_conversation_can_continue_after_switching_provider(self):
        # A turn written by another provider is rebuilt as plain text and tool_use blocks.
        history = [{"role": "user", "text": "hi"},
                   {"role": "assistant", "text": "hello", "tool_calls": [], "native": None, "provider": "groq"}]
        from llm_chat.providers import AnthropicProvider
        self.assertEqual(AnthropicProvider.messages(history)[1], {"role": "assistant", "content": [{"type": "text", "text": "hello"}]})

    def test_lists_models(self):
        from llm_chat.cli import list_models
        with MockServer() as server:
            self.assertEqual(list_models(self.provider(server)), ["model-a", "model-b"])


class GroqTest(unittest.TestCase):
    def provider(self, server, **env):
        return make_provider("groq", env={"GROQ_API_KEY": "gsk-test", "GROQ_BASE_URL": server.url, **env})

    def test_uses_the_groq_endpoint_and_a_default_model(self):
        with MockServer() as server:
            server.reply(chat_reply("Hi from Groq"))
            turn, _h, streamed = chat(self.provider(server), "Hi")
        self.assertEqual((turn.text, streamed, turn.provider), ("Hi from Groq", "Hi from Groq", "groq"))
        request = server.requests[0]
        self.assertEqual(request["path"], "/openai/v1/chat/completions")
        self.assertEqual(request["headers"]["authorization"], "Bearer gsk-test")
        body = request["body"]
        self.assertEqual(body["model"], "llama-3.3-70b-versatile")
        self.assertEqual(body["max_completion_tokens"], 4096)
        self.assertIs(body["stream"], True)
        self.assertEqual(body["messages"], [{"role": "user", "content": "Hi"}])
        self.assertEqual(body["tools"][0]["type"], "function")
        self.assertEqual(body["tools"][0]["function"]["name"], "calculate")

    def test_model_can_be_chosen(self):
        with MockServer() as server:
            server.reply(chat_reply("ok"))
            chat(make_provider("groq", "openai/gpt-oss-20b", env={"GROQ_API_KEY": "k", "GROQ_BASE_URL": server.url}), "x")
        self.assertEqual(server.requests[0]["body"]["model"], "openai/gpt-oss-20b")

    def test_runs_parallel_tool_calls(self):
        with MockServer() as server:
            server.reply(chat_reply("", [("call_a", "calculate", '{"expression": "1 + 2"}'),
                                         ("call_b", "get_time", '{"utc_offset_hours": 2}')]),
                         chat_reply("done"))
            turn, history, _ = chat(self.provider(server), "x")
        self.assertEqual(turn.text, "done")
        messages = server.requests[1]["body"]["messages"]
        self.assertEqual(messages[1]["role"], "assistant")
        self.assertEqual([c["id"] for c in messages[1]["tool_calls"]], ["call_a", "call_b"])
        self.assertEqual(messages[1]["tool_calls"][0]["function"]["arguments"], '{"expression": "1 + 2"}')
        tools = [m for m in messages if m["role"] == "tool"]
        self.assertEqual([(m["tool_call_id"], m["content"][:1]) for m in tools], [("call_a", "3"), ("call_b", "2")])

    def test_invalid_json_arguments_become_an_error_the_model_can_read(self):
        with MockServer() as server:
            server.reply(chat_reply("", [("call_a", "calculate", '{"expression": ')]), chat_reply("retrying"))
            chat(self.provider(server), "x")
        tool = server.requests[1]["body"]["messages"][-1]
        self.assertEqual(tool["role"], "tool")
        self.assertTrue(tool["content"].startswith("Error: Tool arguments were not valid JSON"))

    def test_a_missing_key_is_explained(self):
        with self.assertRaisesRegex(ConfigError, "GROQ_API_KEY"):
            make_provider("groq", env={})


class OpenAICompatibleTest(unittest.TestCase):
    def test_a_local_server_needs_no_key_but_needs_a_model(self):
        with MockServer() as server:
            server.reply(chat_reply("local reply"))
            provider = make_provider("ollama", "llama3.2", base_url=server.url + "/v1", env={})
            turn, _h, _s = chat(provider, "Hi")
        self.assertEqual(turn.text, "local reply")
        request = server.requests[0]
        self.assertEqual(request["path"], "/v1/chat/completions")
        self.assertEqual(request["body"]["model"], "llama3.2")
        self.assertEqual(request["body"]["max_tokens"], 4096)
        with self.assertRaisesRegex(ConfigError, "Choose a model"):
            make_provider("ollama", env={})

    def test_openai_uses_max_completion_tokens_and_its_key(self):
        with MockServer() as server:
            server.reply(chat_reply("ok"))
            provider = make_provider("openai", "any-model", base_url=server.url + "/v1", env={"OPENAI_API_KEY": "sk-test"})
            chat(provider, "x")
        request = server.requests[0]
        self.assertEqual(request["headers"]["authorization"], "Bearer sk-test")
        self.assertEqual(request["body"]["max_completion_tokens"], 4096)
        self.assertNotIn("max_tokens", request["body"])

    def test_custom_server_comes_from_the_environment(self):
        with MockServer() as server:
            server.reply(chat_reply("custom"))
            env = {"LLM_BASE_URL": server.url + "/v1", "LLM_MODEL": "my-model", "LLM_MAX_TOKENS": "100"}
            turn, _h, _s = chat(make_provider("custom", env=env), "x")
        self.assertEqual(turn.text, "custom")
        self.assertEqual(server.requests[0]["body"]["model"], "my-model")
        self.assertEqual(server.requests[0]["body"]["max_tokens"], 100)
        with self.assertRaisesRegex(ConfigError, "LLM_BASE_URL"):
            make_provider("custom", "m", env={})

    def test_a_length_stop_and_a_filter_stop_are_reported(self):
        with MockServer() as server:
            server.reply(chat_reply("partial", finish="length"), chat_reply("", finish="content_filter"))
            provider = make_provider("ollama", "m", base_url=server.url + "/v1", env={})
            self.assertEqual(chat(provider, "x", tools=False)[0].stop_reason, "max_tokens")
            self.assertEqual(chat(provider, "x", tools=False)[0].stop_reason, "refusal")

    def test_api_errors_reach_the_caller(self):
        import openai

        with MockServer() as server:
            server.reply((401, {"error": {"message": "bad key", "type": "invalid_request_error"}}))
            provider = make_provider("openai", "m", base_url=server.url + "/v1", env={"OPENAI_API_KEY": "bad"})
            with self.assertRaises(openai.AuthenticationError):
                chat(provider, "x")

    def test_unknown_provider_lists_the_choices(self):
        with self.assertRaisesRegex(ConfigError, "Choose one of: anthropic, groq, openai"):
            make_provider("nope", env={})


if __name__ == "__main__":
    unittest.main()
