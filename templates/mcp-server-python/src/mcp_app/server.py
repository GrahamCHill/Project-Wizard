"""A small Model Context Protocol server: three tools, a resource, and a prompt.

An MCP server lets an AI application such as Claude Desktop or Claude Code call your code. Tools do work,
resources expose data the model can read, and prompts are reusable instructions the user can pick.

Over stdio the protocol uses stdout, so never print to it. Write logs to stderr.
"""

from __future__ import annotations

import re
import sys

from mcp.server.mcpserver import MCPServer
from mcp.server.mcpserver.exceptions import ResourceNotFoundError, ToolError
from mcp.types import ToolAnnotations
from pydantic import BaseModel, Field

MAX_TEXT = 100_000

# Replace this with your own data source. Anything a resource returns becomes context for the model.
NOTES: dict[str, str] = {
    "welcome": "This note is served by the notes://{name} resource template.",
    "next-steps": "Add your own tools in server.py, then run the tests with `python -m unittest discover -s tests`.",
}

# Every tool here only reads its arguments, so say so. Clients use these hints to decide what to confirm.
READ_ONLY = ToolAnnotations(read_only_hint=True, idempotent_hint=True, open_world_hint=False)


class TextStats(BaseModel):
    """Structured output: MCP clients receive this as JSON that matches the model's schema."""

    words: int = Field(description="Number of whitespace-separated words")
    characters: int
    lines: int
    longest_word: str


def create_server() -> MCPServer:
    server = MCPServer(
        "__PROJECT_NAME__",
        instructions="Use add for arithmetic, text_stats to measure text, and slugify to make URL-safe names. "
                     "Read notes://index to see the available notes.",
    )

    @server.tool(annotations=READ_ONLY)
    def add(a: int, b: int) -> int:
        """Add two integers."""
        return a + b

    @server.tool(annotations=READ_ONLY)
    def text_stats(text: str) -> TextStats:
        """Count the words, characters, and lines in some text."""
        if len(text) > MAX_TEXT:
            # A ToolError is reported to the model as a normal failed tool call that it can read and react to.
            raise ToolError(f"The text is too long. Send at most {MAX_TEXT} characters.")
        words = text.split()
        return TextStats(words=len(words), characters=len(text), lines=len(text.splitlines()),
                         longest_word=max(words, key=len, default=""))

    @server.tool(annotations=READ_ONLY)
    def slugify(text: str) -> str:
        """Turn text into a lowercase, hyphen-separated slug that is safe to use in a URL."""
        slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
        if not slug:
            raise ToolError("The text has no letters or digits to make a slug from.")
        return slug

    @server.resource("notes://index")
    def notes_index() -> str:
        """The names of the available notes."""
        return "\n".join(sorted(NOTES))

    @server.resource("notes://{name}")
    def read_note(name: str) -> str:
        """The text of one note."""
        try:
            return NOTES[name]
        except KeyError:
            raise ResourceNotFoundError(f"There is no note named {name!r}.") from None

    @server.prompt()
    def review_code(code: str, language: str = "python") -> str:
        """Ask for a careful code review."""
        return (f"Review this {language} code. List real bugs first, then risks, then style. "
                f"Quote the lines you mean.\n\n```{language}\n{code}\n```")

    return server


mcp = create_server()


def main() -> None:
    print("Serving over stdio. Press Ctrl+C to stop.", file=sys.stderr)
    mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
