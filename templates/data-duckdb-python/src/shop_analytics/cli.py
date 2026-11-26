"""Command line for the warehouse. Run `python -m shop_analytics --help`."""

from __future__ import annotations

import argparse
import csv
import io
import sys
from pathlib import Path
from typing import Sequence

import duckdb

from . import pipeline
from .db import ROOT, connect, rows

DEFAULT_DATABASE = ROOT / "warehouse.duckdb"


def format_table(columns: Sequence[str], data: Sequence[tuple]) -> str:
    cells = [[("" if value is None else str(value)) for value in row] for row in data]
    widths = [max([len(name)] + [len(row[index]) for row in cells]) for index, name in enumerate(columns)]
    line = lambda values: "  ".join(value.ljust(width) for value, width in zip(values, widths)).rstrip()
    return "\n".join([line(columns), line(["-" * width for width in widths]), *(line(row) for row in cells)])


def format_csv(columns: Sequence[str], data: Sequence[tuple]) -> str:
    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\n")
    writer.writerow(columns)
    writer.writerows(data)
    return buffer.getvalue().rstrip("\n")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="__PROJECT_SLUG__", description="A DuckDB analytics warehouse.")
    parser.add_argument("--db", type=Path, default=DEFAULT_DATABASE, help="Database file (default: warehouse.duckdb in the project)")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("load", help="Create the warehouse from the CSV files in data/")
    commands.add_parser("check", help="Check the data. Exits with 1 when a rule is broken")
    commands.add_parser("reports", help="List the reports")
    report = commands.add_parser("report", help="Run a report")
    report.add_argument("name")
    report.add_argument("--format", choices=["table", "csv"], default="table")
    query = commands.add_parser("query", help="Run any SQL. The database is opened read-only")
    query.add_argument("sql")
    query.add_argument("--format", choices=["table", "csv"], default="table")
    export = commands.add_parser("export", help="Write every table to a Parquet file")
    export.add_argument("--out", type=Path, default=ROOT / "exports")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        if args.command == "reports":
            print("\n".join(pipeline.list_reports()))
            return 0
        if args.command == "load":
            with connect(args.db) as con:
                counts = pipeline.load(con)
            print("Loaded " + ", ".join(f"{count} {table}" for table, count in counts.items()) + f" into {args.db}")
            return 0
        if not args.db.exists():
            print(f"error: {args.db} does not exist. Run `load` first.", file=sys.stderr)
            return 2
        # Everything except load only reads, so open read-only: nothing here can change the data.
        with connect(args.db, read_only=True) as con:
            if args.command == "check":
                problems = pipeline.check(con)
                print("\n".join(problems) if problems else "All data checks passed.")
                return 1 if problems else 0
            if args.command == "export":
                for path in pipeline.export_parquet(con, args.out):
                    print(f"Wrote {path}")
                return 0
            columns, data = pipeline.run_report(con, args.name) if args.command == "report" else rows(con, args.sql)
            print((format_csv if args.format == "csv" else format_table)(columns, data))
            return 0
    except ValueError as error:
        print(f"error: {error}", file=sys.stderr)
        return 2
    except duckdb.Error as error:
        print(f"error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
