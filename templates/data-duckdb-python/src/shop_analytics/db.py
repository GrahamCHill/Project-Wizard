"""Opening DuckDB and running SQL files."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Sequence

import duckdb

# The project folder, which holds data/ and sql/. It works when the package is installed with `pip install -e .`.
ROOT = Path(__file__).resolve().parents[2]


def connect(path: str | Path | None = None, *, read_only: bool = False) -> duckdb.DuckDBPyConnection:
    """Opens a database file, or an in-memory database when `path` is None.

    DuckDB keeps a database in a single file and needs no server. Open it with read_only=True to run
    queries that must not change anything, and so that several processes can read it at the same time.
    """
    return duckdb.connect(":memory:" if path is None else str(path), read_only=read_only)


def run_script(con: duckdb.DuckDBPyConnection, path: str | Path) -> None:
    """Runs every statement in a SQL file."""
    con.execute(Path(path).read_text(encoding="utf-8"))


def rows(con: duckdb.DuckDBPyConnection, sql: str, parameters: Sequence[Any] | None = None) -> tuple[list[str], list[tuple]]:
    """Runs a query and returns its column names and rows.

    Pass values as `parameters` and write `?` in the SQL, never format values into the SQL text.
    """
    cursor = con.execute(sql, list(parameters) if parameters else None)
    return [column[0] for column in cursor.description], cursor.fetchall()
