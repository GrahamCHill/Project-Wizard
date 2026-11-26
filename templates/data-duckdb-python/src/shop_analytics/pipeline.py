"""Loading the CSV files, checking the data, running reports, and exporting Parquet."""

from __future__ import annotations

from pathlib import Path

import duckdb

from .db import ROOT, rows, run_script

# Each table, its CSV file, and the type of every column. Naming the types stops DuckDB from guessing them.
TABLES: dict[str, tuple[str, dict[str, str]]] = {
    "customers": ("customers.csv", {"customer_id": "INTEGER", "name": "VARCHAR", "country": "VARCHAR", "signup_date": "DATE"}),
    "products": ("products.csv", {"product_id": "INTEGER", "name": "VARCHAR", "category": "VARCHAR", "unit_price": "DECIMAL(10,2)"}),
    "orders": ("orders.csv", {"order_id": "INTEGER", "customer_id": "INTEGER", "product_id": "INTEGER", "quantity": "INTEGER",
                              "ordered_at": "DATE", "status": "VARCHAR"}),
}

# Each check is a name and a query that returns the rows that break the rule. No rows means the data is fine.
CHECKS: dict[str, str] = {
    "orders placed before the customer signed up":
        "SELECT o.order_id FROM orders o JOIN customers c USING (customer_id) WHERE o.ordered_at < c.signup_date",
    "customers with no orders":
        "SELECT c.customer_id FROM customers c LEFT JOIN orders o USING (customer_id) WHERE o.order_id IS NULL",
    "revenue that differs between the view and a direct sum":
        "SELECT 1 FROM (SELECT (SELECT COALESCE(SUM(revenue), 0) FROM completed_sales) AS view_total, "
        "(SELECT COALESCE(SUM(o.quantity * p.unit_price), 0) FROM orders o JOIN products p USING (product_id) "
        "WHERE o.status = 'completed') AS direct_total) WHERE view_total <> direct_total",
}


def load(con: duckdb.DuckDBPyConnection, root: Path = ROOT) -> dict[str, int]:
    """Creates the schema and loads every CSV file. Returns how many rows each table has."""
    run_script(con, root / "sql" / "schema.sql")
    counts = {}
    for table, (filename, columns) in TABLES.items():
        # Table and column names come from the constants above, and the file path is a parameter.
        types = ", ".join(f"'{name}': '{kind}'" for name, kind in columns.items())
        con.execute(f"INSERT INTO {table} SELECT * FROM read_csv(?, header = true, columns = {{{types}}})",
                    [str(root / "data" / filename)])
        counts[table] = con.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
    return counts


def check(con: duckdb.DuckDBPyConnection) -> list[str]:
    """Runs the data checks and returns one message for each rule that is broken."""
    problems = []
    for rule, query in CHECKS.items():
        count = len(con.execute(query).fetchall())
        if count:
            problems.append(f"{count} {rule}")
    return problems


def list_reports(root: Path = ROOT) -> list[str]:
    """The names of the reports, which are the SQL files in sql/reports."""
    return sorted(path.stem for path in (root / "sql" / "reports").glob("*.sql"))


def run_report(con: duckdb.DuckDBPyConnection, name: str, root: Path = ROOT) -> tuple[list[str], list[tuple]]:
    """Runs a report by name. Only names from list_reports are accepted, so a name cannot point at another file."""
    if name not in list_reports(root):
        raise ValueError(f"Unknown report {name!r}. Choose one of: {', '.join(list_reports(root))}.")
    return rows(con, (root / "sql" / "reports" / f"{name}.sql").read_text(encoding="utf-8"))


def _quote(path: Path) -> str:
    return "'" + str(path).replace("'", "''") + "'"


def export_parquet(con: duckdb.DuckDBPyConnection, directory: Path) -> list[Path]:
    """Writes each table to a Parquet file, a compressed column format that Spark, pandas, Polars, and others read."""
    directory.mkdir(parents=True, exist_ok=True)
    written = []
    for table in TABLES:
        target = directory / f"{table}.parquet"
        con.execute(f"COPY (SELECT * FROM {table} ORDER BY 1) TO {_quote(target)} (FORMAT parquet)")
        written.append(target)
    return written
