"""Starts the server as a subprocess, the way Claude Desktop and Claude Code do, and talks to it over stdio."""

import os
import sys
import unittest
from pathlib import Path

from mcp import Client, StdioServerParameters

SOURCE = str(Path(__file__).resolve().parents[1] / "src")


class StdioTest(unittest.IsolatedAsyncioTestCase):
    async def test_a_real_client_can_call_the_server_over_stdio(self):
        # PYTHONPATH lets the test run even before the package is installed.
        env = {**os.environ, "PYTHONPATH": SOURCE + os.pathsep + os.environ.get("PYTHONPATH", "")}
        parameters = StdioServerParameters(command=sys.executable, args=["-m", "mcp_app"], env=env)
        async with Client(parameters) as client:
            self.assertEqual(client.server_info.name, "__PROJECT_NAME__")
            self.assertEqual(len((await client.list_tools()).tools), 3)
            result = await client.call_tool("add", {"a": 20, "b": 22})
            self.assertEqual(result.structured_content, {"result": 42})


if __name__ == "__main__":
    unittest.main()
