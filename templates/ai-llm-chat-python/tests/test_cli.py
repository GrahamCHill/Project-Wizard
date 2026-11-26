import contextlib
import io
import os
import unittest
from unittest import mock

from llm_chat import PRESETS
from llm_chat.cli import describe_providers, main
from mock_llm import MockServer, chat_reply


PROVIDER_VARIABLES = ("ANTHROPIC_", "GROQ_", "OPENAI_", "LLM_", "TOGETHER_", "MISTRAL_", "OPENROUTER_", "DEEPSEEK_", "XAI_", "GEMINI_")


def run(argv, env=None):
    out, err = io.StringIO(), io.StringIO()
    # Remove only provider variables. Clearing everything would also remove SYSTEMROOT, which sockets need on Windows.
    clean = {k: v for k, v in os.environ.items() if not k.startswith(PROVIDER_VARIABLES)}
    with mock.patch.dict(os.environ, {**clean, **(env or {})}, clear=True), contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
        code = main(argv)
    return code, out.getvalue(), err.getvalue()


class CliTest(unittest.TestCase):
    def test_lists_every_provider_and_what_it_needs(self):
        code, out, _ = run(["--list-providers"])
        self.assertEqual(code, 0)
        for name in PRESETS:
            self.assertIn(name, out)
        self.assertIn("GROQ_API_KEY", out)
        self.assertIn("ANTHROPIC_API_KEY", describe_providers())

    def test_asks_one_question_and_prints_the_answer(self):
        with MockServer() as server:
            server.reply(chat_reply("Paris."))
            code, out, _ = run(["--provider", "groq", "--no-tools", "Capital", "of", "France?"],
                               {"GROQ_API_KEY": "k", "GROQ_BASE_URL": server.url})
        self.assertEqual((code, out), (0, "Paris.\n"))
        self.assertEqual(server.requests[0]["body"]["messages"][-1]["content"], "Capital of France?")
        self.assertNotIn("tools", server.requests[0]["body"])

    def test_shows_each_tool_call_on_stderr(self):
        with MockServer() as server:
            server.reply(chat_reply("", [("call_1", "calculate", '{"expression": "6*7"}')]), chat_reply("42"))
            code, out, err = run(["-p", "groq", "6*7?"], {"GROQ_API_KEY": "k", "GROQ_BASE_URL": server.url})
        self.assertEqual((code, out), (0, "42\n"))
        self.assertIn('[tool] calculate({"expression": "6*7"})', err)

    def test_explains_a_missing_key_with_exit_code_2(self):
        code, _out, err = run(["-p", "groq", "hi"])
        self.assertEqual(code, 2)
        self.assertIn("Set GROQ_API_KEY", err)

    def test_the_provider_can_come_from_the_environment(self):
        code, _out, err = run(["hi"], {"LLM_PROVIDER": "openai"})
        self.assertEqual(code, 2)
        self.assertIn("OPENAI_API_KEY", err)

    def test_interactive_chat_keeps_history_until_reset(self):
        with MockServer() as server:
            server.reply(chat_reply("one"), chat_reply("two"), chat_reply("three"))
            inputs = iter(["first", "second", "/reset", "third", "/exit"])
            with mock.patch("builtins.input", lambda _prompt: next(inputs)):
                code, out, _ = run(["-p", "groq", "--no-tools"], {"GROQ_API_KEY": "k", "GROQ_BASE_URL": server.url})
        self.assertEqual((code, out), (0, "one\ntwo\nthree\n"))
        sizes = [len(r["body"]["messages"]) for r in server.requests]
        self.assertEqual(sizes, [2, 4, 2])  # system + user, then the history grows, then /reset starts over

    def test_lists_models(self):
        with MockServer() as server:
            code, out, _ = run(["-p", "anthropic", "--list-models"], {"ANTHROPIC_API_KEY": "k", "ANTHROPIC_BASE_URL": server.url})
        self.assertEqual((code, out.split()), (0, ["model-a", "model-b"]))


if __name__ == "__main__":
    unittest.main()
