"""Tests the server in-process: the client talks to the server object directly, with no subprocess or network."""

import unittest

from mcp import Client
from mcp.shared.exceptions import MCPError

from mcp_app.server import MAX_TEXT, create_server


def connect():
    # Each test opens its own connection. The client's task scope must start and end in the same task.
    return Client(create_server())


def texts(result):
    return [block.text for block in result.content if hasattr(block, "text")]


class ServerTest(unittest.IsolatedAsyncioTestCase):
    async def test_describes_itself_to_clients(self):
        async with connect() as client:
            self.assertEqual(client.server_info.name, "__PROJECT_NAME__")
            self.assertIn("text_stats", client.instructions)

    async def test_lists_tools_with_schemas_and_read_only_hints(self):
        async with connect() as client:
            tools = {tool.name: tool for tool in (await client.list_tools()).tools}
        self.assertEqual(set(tools), {"add", "text_stats", "slugify"})
        self.assertEqual(tools["add"].input_schema["required"], ["a", "b"])
        self.assertEqual(tools["add"].description, "Add two integers.")
        for tool in tools.values():
            self.assertIs(tool.annotations.read_only_hint, True, tool.name)
        self.assertEqual(set(tools["text_stats"].output_schema["properties"]), {"words", "characters", "lines", "longest_word"})

    async def test_add(self):
        async with connect() as client:
            result = await client.call_tool("add", {"a": 2, "b": 40})
        self.assertFalse(result.is_error)
        self.assertEqual(result.structured_content, {"result": 42})
        self.assertEqual(texts(result), ["42"])

    async def test_arguments_are_validated_against_the_schema(self):
        async with connect() as client:
            result = await client.call_tool("add", {"a": "two", "b": 1})
        self.assertTrue(result.is_error)
        self.assertIn("valid integer", texts(result)[0])

    async def test_text_stats_returns_structured_output(self):
        async with connect() as client:
            result = await client.call_tool("text_stats", {"text": "one two\nthree"})
            empty = await client.call_tool("text_stats", {"text": ""})
        self.assertEqual(result.structured_content, {"words": 3, "characters": 13, "lines": 2, "longest_word": "three"})
        self.assertEqual(empty.structured_content["longest_word"], "")

    async def test_anticipated_failures_come_back_as_tool_errors(self):
        async with connect() as client:
            too_long = await client.call_tool("text_stats", {"text": "x" * (MAX_TEXT + 1)})
            empty = await client.call_tool("slugify", {"text": "***"})
        self.assertTrue(too_long.is_error)
        self.assertIn("too long", texts(too_long)[0])
        self.assertTrue(empty.is_error)

    async def test_slugify(self):
        async with connect() as client:
            for text, slug in [("Hello, World!", "hello-world"), ("  Café  au lait  ", "caf-au-lait"), ("A--B__C", "a-b-c")]:
                result = await client.call_tool("slugify", {"text": text})
                self.assertEqual(result.structured_content, {"result": slug}, text)

    async def test_unknown_tool_is_an_error(self):
        async with connect() as client:
            result = await client.call_tool("nope", {})
        self.assertTrue(result.is_error)

    async def test_resources(self):
        async with connect() as client:
            templates = (await client.list_resource_templates()).resource_templates
            static = (await client.list_resources()).resources
            index = await client.read_resource("notes://index")
            note = await client.read_resource("notes://welcome")
        self.assertEqual([t.uri_template for t in templates], ["notes://{name}"])
        self.assertEqual([str(r.uri) for r in static], ["notes://index"])
        self.assertEqual(index.contents[0].text, "next-steps\nwelcome")
        self.assertIn("resource template", note.contents[0].text)

    async def test_a_missing_note_is_an_invalid_params_error(self):
        async with connect() as client:
            with self.assertRaises(MCPError) as caught:
                await client.read_resource("notes://missing")
        self.assertEqual(caught.exception.code, -32602)
        self.assertIn("no note named 'missing'", str(caught.exception))

    async def test_prompt(self):
        async with connect() as client:
            listed = (await client.list_prompts()).prompts
            prompt = await client.get_prompt("review_code", {"code": "x = 1", "language": "python"})
        self.assertEqual([p.name for p in listed], ["review_code"])
        self.assertEqual(prompt.messages[0].role, "user")
        self.assertIn("```python\nx = 1\n```", prompt.messages[0].content.text)


if __name__ == "__main__":
    unittest.main()
