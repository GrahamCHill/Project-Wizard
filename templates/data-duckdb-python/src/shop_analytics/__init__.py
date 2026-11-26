"""A small DuckDB analytics warehouse: load CSV files, check them, run SQL reports, and export Parquet."""

from .db import ROOT, connect
from .pipeline import check, export_parquet, list_reports, load, run_report

__all__ = ["ROOT", "check", "connect", "export_parquet", "list_reports", "load", "run_report"]
