import unittest

from llm_chat import AgentError, Tool, ToolCall, ToolSpec, Turn, default_tools, run_turn
from llm_chat.providers import Provider
from llm_chat.tools import calculate, get_time, validate_arguments


class CalculateTest(unittest.TestCase):
    def test_evaluates_arithmetic(self):
        for expression, expected in [("2 + 3 * 4", "14"), ("(1 + 2) ** 3", "27"), ("7 / 2", "3.5"), ("-4 + +6", "2"),
                                     ("10 // 3", "3"), ("10 % 4", "2"), ("0.1 + 0.2", str(0.1 + 0.2))]:
            self.assertEqual(calculate(expression), expected, expression)

    def test_never_runs_code(self):
        for expression in ["__import__('os').system('echo hi')", "open('x')", "[1][0]", "1 if True else 2", "lambda: 1",
                           "'a' * 3", "True + 1", "abs(-1)", "x"]:
            self.assertTrue(calculate(expression).startswith("Error:"), expression)

    def test_rejects_expressions_that_would_hang_or_overflow(self):
        self.assertEqual(calculate("9 ** 9 ** 9"), "Error: That power is too large.")
        self.assertEqual(calculate("10 ** 101"), "Error: That power is too large.")
        self.assertEqual(calculate("1 / 0"), "Error: division by zero.")
        self.assertEqual(calculate("1 + " * 100 + "1")[:6], "Error:")
        self.assertEqual(calculate("1" * 300), "Error: the expression is too long.")
        self.assertEqual(calculate("(" * 150 + "1" + ")" * 150)[:6], "Error:")


class ValidateTest(unittest.TestCase):
    schema = {"type": "object", "properties": {"a": {"type": "string"}, "n": {"type": "integer"}, "f": {"type": "number"},
                                                "b": {"type": "boolean"}}, "required": ["a"]}

    def test_accepts_matching_arguments(self):
        self.assertIsNone(validate_arguments(self.schema, {"a": "x", "n": 1, "f": 1.5, "b": True}))
        self.assertIsNone(validate_arguments(self.schema, {"a": "x", "f": 2}))

    def test_reports_the_first_problem(self):
        cases = [({}, "Missing required argument 'a'"), ({"a": 1}, "must be of type string"),
                 ({"a": "x", "n": True}, "must be of type integer"), ({"a": "x", "n": 1.5}, "must be of type integer"),
                 ({"a": "x", "b": "yes"}, "must be of type boolean"), ({"a": "x", "extra": 1}, "Unexpected argument"),
                 ([], "must be a JSON object"), (None, "must be a JSON object")]
        for arguments, message in cases:
            self.assertIn(message, validate_arguments(self.schema, arguments) or "", arguments)

    def test_get_time_checks_its_range(self):
        self.assertRegex(get_time(2), r"^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d UTC\+0200$")
        self.assertRegex(get_time(-5.5), r"UTC-0530$")
        self.assertTrue(get_time(15).startswith("Error:"))


class Scripted(Provider):
    """Replays prepared turns, and keeps what it was asked."""

    name = "scripted"

    def __init__(self, *turns):
        self.turns, self.calls = list(turns), []

    def stream_turn(self, system, history, tools, on_text):
        self.calls.append({"system": system, "history": [dict(item) for item in history], "tools": [t.name for t in tools]})
        turn = self.turns.pop(0)
        on_text(turn.text)
        return turn


def call(name, arguments, id="c1"):
    return ToolCall(id, name, arguments)


class AgentTest(unittest.TestCase):
    def test_runs_tools_until_the_model_answers(self):
        provider = Scripted(Turn(tool_calls=[call("calculate", {"expression": "2+2"})], stop_reason="tool_use"), Turn(text="4"))
        history, seen, text = [], [], []
        turn = run_turn(provider, history, "2+2?", default_tools(), system="be brief", on_text=text.append, on_tool=seen.append)
        self.assertEqual(turn.text, "4")
        self.assertEqual([c.name for c in seen], ["calculate"])
        self.assertEqual(provider.calls[0]["system"], "be brief")
        self.assertEqual(provider.calls[0]["tools"], ["calculate", "get_time"])
        self.assertEqual(history[2], {"role": "tool", "results": [{"id": "c1", "name": "calculate", "content": "4", "is_error": False}]})

    def test_failures_become_error_results_instead_of_ending_the_chat(self):
        def broken(**_):
            raise RuntimeError("boom")

        tools = default_tools() + [Tool(ToolSpec("broken", "x", {"type": "object", "properties": {}, "required": []}), broken)]
        bad = ToolCall("c3", "calculate", {}, error="Tool arguments were not valid JSON: x.")
        provider = Scripted(Turn(tool_calls=[call("nope", {}, "c1"), call("broken", {}, "c2"), bad, call("calculate", {}, "c4")],
                                 stop_reason="tool_use"), Turn(text="ok"))
        history = []
        run_turn(provider, history, "go", tools)
        results = {r["id"]: (r["content"], r["is_error"]) for r in history[2]["results"]}
        self.assertEqual(results["c1"], ("Unknown tool 'nope'.", True))
        self.assertEqual(results["c2"], ("RuntimeError: boom", True))
        self.assertEqual(results["c3"][1], True)
        self.assertEqual(results["c4"], ("Missing required argument 'expression'.", True))

    def test_a_truncated_turn_does_not_run_its_tools(self):
        provider = Scripted(Turn(tool_calls=[call("calculate", {"expression": "1"})], stop_reason="max_tokens"))
        history = []
        turn = run_turn(provider, history, "x", default_tools())
        self.assertEqual(turn.stop_reason, "max_tokens")
        self.assertEqual([m["role"] for m in history], ["user", "assistant"])

    def test_stops_a_model_that_never_finishes(self):
        looping = [Turn(tool_calls=[call("get_time", {}, f"c{i}")], stop_reason="tool_use") for i in range(5)]
        with self.assertRaisesRegex(AgentError, "3 steps"):
            run_turn(Scripted(*looping), [], "x", default_tools(), max_steps=3)

    def test_works_without_tools(self):
        provider = Scripted(Turn(text="hi"))
        self.assertEqual(run_turn(provider, [], "x").text, "hi")
        self.assertEqual(provider.calls[0]["tools"], [])


if __name__ == "__main__":
    unittest.main()
