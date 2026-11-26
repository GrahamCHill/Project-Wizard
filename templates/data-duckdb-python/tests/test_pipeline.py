"""Tests for loading, checking, reporting, and exporting.

Most tests build a tiny warehouse in a temporary folder, with numbers small enough to check by hand. The last ones
check the sample data that ships in data/. Run them with `python -m unittest discover -s tests`.
"""

import contextlib
import io
import shutil
import tempfile
import unittest
from datetime import date
from decimal import Decimal
from pathlib import Path

import duckdb

from shop_analytics import ROOT, check, connect, export_parquet, list_reports, load, run_report
from shop_analytics.cli import format_csv, format_table, main
from shop_analytics.db import rows

CUSTOMERS = "customer_id,name,country,signup_date\n1,Ada,Germany,2025-01-01\n2,Grace,Japan,2025-01-15\n3,Linus,Kenya,2025-02-01\n"
PRODUCTS = "product_id,name,category,unit_price\n1,Keyboard,Hardware,10.00\n2,Course,Services,25.00\n"
# order_id, customer, product, quantity, date, status. Orders 5 and 7 are not completed, so no report counts them.
ORDERS = """order_id,customer_id,product_id,quantity,ordered_at,status
1,1,1,2,2025-01-10,completed
2,2,2,1,2025-01-20,completed
3,1,2,1,2025-02-05,completed
4,3,1,3,2025-02-10,completed
5,2,1,1,2025-04-02,refunded
6,1,1,1,2025-04-15,completed
7,3,2,1,2025-03-03,cancelled
"""


class Workspace(unittest.TestCase):
    """A project folder in a temporary directory, with the real SQL files and the test data."""

    def make_root(self, customers=CUSTOMERS, products=PRODUCTS, orders=ORDERS):
        root = Path(tempfile.mkdtemp(prefix="shop-test-"))
        self.addCleanup(shutil.rmtree, root, ignore_errors=True)
        shutil.copytree(ROOT / "sql", root / "sql")
        (root / "data").mkdir()
        for name, text in {"customers.csv": customers, "products.csv": products, "orders.csv": orders}.items():
            (root / "data" / name).write_text(text, encoding="utf-8")
        return root

    def warehouse(self, **data):
        root = self.make_root(**data)
        con = connect()
        self.addCleanup(con.close)
        load(con, root)
        return con, root


class LoadingTest(Workspace):
    def test_loads_every_table(self):
        con, root = self.warehouse()
        self.assertEqual(load(con, root), {"customers": 3, "products": 2, "orders": 7})
        self.assertEqual(rows(con, "SELECT typeof(unit_price), typeof(ordered_at) FROM products, orders LIMIT 1")[1], [("DECIMAL(10,2)", "DATE")])

    def test_loading_again_replaces_the_data_instead_of_adding_to_it(self):
        con, root = self.warehouse()
        load(con, root)
        self.assertEqual(con.execute("SELECT COUNT(*) FROM orders").fetchone()[0], 7)

    def test_the_database_rejects_data_that_breaks_a_rule(self):
        bad = {
            "an order for a customer that does not exist": ORDERS + "8,99,1,1,2025-05-01,completed\n",
            "an order for a product that does not exist": ORDERS + "8,1,99,1,2025-05-01,completed\n",
            "a quantity of zero": ORDERS + "8,1,1,0,2025-05-01,completed\n",
            "an unknown status": ORDERS + "8,1,1,1,2025-05-01,shipped\n",
            "a duplicate order id": ORDERS + "1,1,1,1,2025-05-01,completed\n",
            "a malformed date": ORDERS + "8,1,1,1,not-a-date,completed\n",
        }
        for label, orders in bad.items():
            root = self.make_root(orders=orders)
            with connect() as con, self.assertRaises(duckdb.Error, msg=label):
                load(con, root)
        root = self.make_root(products=PRODUCTS + "3,Free,Software,0.00\n")
        with connect() as con, self.assertRaises(duckdb.Error, msg="a price of zero"):
            load(con, root)

    def test_revenue_counts_completed_orders_only(self):
        con, _ = self.warehouse()
        self.assertEqual(con.execute("SELECT SUM(revenue) FROM completed_sales").fetchone()[0], Decimal("110.00"))
        self.assertEqual(con.execute("SELECT COUNT(*) FROM completed_sales").fetchone()[0], 5)


class ReportsTest(Workspace):
    def test_lists_the_reports_in_the_sql_folder(self):
        self.assertEqual(list_reports(), ["category_by_quarter", "customer_cohorts", "monthly_revenue", "top_customers"])

    def test_monthly_revenue_with_a_running_total_and_the_change_from_the_previous_month(self):
        con, root = self.warehouse()
        columns, data = run_report(con, "monthly_revenue", root)
        self.assertEqual(columns, ["month", "orders", "revenue", "running_total", "change_pct"])
        self.assertEqual([(m, o, r, t) for m, o, r, t, _ in data], [
            (date(2025, 1, 1), 2, Decimal("45.00"), Decimal("45.00")),
            (date(2025, 2, 1), 2, Decimal("55.00"), Decimal("100.00")),
            (date(2025, 4, 1), 1, Decimal("10.00"), Decimal("110.00")),
        ])
        self.assertIsNone(data[0][4], "the first month has nothing to compare with")
        self.assertAlmostEqual(float(data[1][4]), 22.2, places=1)
        # March has no completed orders, so April is compared with February.
        self.assertAlmostEqual(float(data[2][4]), -81.8, places=1)

    def test_top_customers_are_ranked_by_revenue(self):
        con, root = self.warehouse()
        _, data = run_report(con, "top_customers", root)
        self.assertEqual(data, [("Ada", "Germany", 3, Decimal("55.00"), 1), ("Linus", "Kenya", 1, Decimal("30.00"), 2),
                                ("Grace", "Japan", 1, Decimal("25.00"), 3)])

    def test_customers_that_tie_share_a_rank_so_the_list_can_exceed_five(self):
        customers = "customer_id,name,country,signup_date\n" + "".join(f"{i},C{i},Peru,2025-01-01\n" for i in range(1, 8))
        orders = "order_id,customer_id,product_id,quantity,ordered_at,status\n" + "".join(f"{i},{i},1,1,2025-01-05,completed\n" for i in range(1, 8))
        con, root = self.warehouse(customers=customers, orders=orders)
        _, data = run_report(con, "top_customers", root)
        self.assertEqual((len(data), {row[4] for row in data}), (7, {1}))

    def test_category_revenue_pivoted_by_quarter(self):
        con, root = self.warehouse()
        columns, data = run_report(con, "category_by_quarter", root)
        self.assertEqual(columns, ["category", "Q1", "Q2", "Q3", "Q4"])
        self.assertEqual(data, [("Hardware", Decimal("50.00"), Decimal("10.00"), None, None),
                                ("Services", Decimal("50.00"), None, None, None)])

    def test_cohorts_count_customers_by_months_since_their_first_purchase(self):
        con, root = self.warehouse()
        _, data = run_report(con, "customer_cohorts", root)
        self.assertEqual(data, [(date(2025, 1, 1), 0, 2), (date(2025, 1, 1), 1, 1), (date(2025, 1, 1), 3, 1), (date(2025, 2, 1), 0, 1)])

    def test_a_report_name_cannot_reach_another_file(self):
        con, root = self.warehouse()
        for name in ["../schema", "..\\schema", "schema", "", "monthly_revenue.sql", "nope"]:
            with self.assertRaisesRegex(ValueError, "Unknown report"):
                run_report(con, name, root)

    def test_values_are_passed_as_parameters_and_never_become_sql(self):
        con, _ = self.warehouse()
        attack = "x'; DROP TABLE orders; --"
        self.assertEqual(rows(con, "SELECT ? AS value", [attack])[1], [(attack,)])
        self.assertEqual(rows(con, "SELECT COUNT(*) FROM orders WHERE status = ?", [attack])[1], [(0,)])
        self.assertEqual(con.execute("SELECT COUNT(*) FROM orders").fetchone()[0], 7)


class CheckTest(Workspace):
    def test_clean_data_passes(self):
        con, _ = self.warehouse(orders=ORDERS + "8,3,2,1,2025-05-01,completed\n")
        self.assertEqual(check(con), [])

    def test_reports_each_rule_that_is_broken(self):
        # Order 3 is placed before Linus signed up, and Grace has no orders.
        orders = "order_id,customer_id,product_id,quantity,ordered_at,status\n1,1,1,1,2025-01-10,completed\n2,3,1,1,2025-01-20,completed\n"
        con, _ = self.warehouse(orders=orders)
        self.assertEqual(check(con), ["1 orders placed before the customer signed up", "1 customers with no orders"])


class ExportTest(Workspace):
    def test_parquet_files_hold_the_same_rows(self):
        con, _ = self.warehouse()
        out = Path(tempfile.mkdtemp(prefix="shop-export-"))
        self.addCleanup(shutil.rmtree, out, ignore_errors=True)
        written = export_parquet(con, out / "nested")
        self.assertEqual(sorted(path.name for path in written), ["customers.parquet", "orders.parquet", "products.parquet"])
        for table, expected in {"customers": 3, "products": 2, "orders": 7}.items():
            count = duckdb.connect().execute("SELECT COUNT(*) FROM read_parquet(?)", [str(out / "nested" / f"{table}.parquet")]).fetchone()[0]
            self.assertEqual(count, expected, table)

    def test_a_folder_name_with_a_quote_cannot_break_the_export(self):
        con, _ = self.warehouse()
        out = Path(tempfile.mkdtemp(prefix="shop-export-")) / "it's here"
        self.addCleanup(shutil.rmtree, out.parent, ignore_errors=True)
        self.assertEqual(len(export_parquet(con, out)), 3)


class ConnectionTest(unittest.TestCase):
    def test_a_read_only_connection_cannot_change_the_database(self):
        directory = Path(tempfile.mkdtemp(prefix="shop-db-"))
        self.addCleanup(shutil.rmtree, directory, ignore_errors=True)
        path = directory / "w.duckdb"
        with connect(path) as con:
            con.execute("CREATE TABLE t (i INTEGER)")
        with connect(path, read_only=True) as con:
            self.assertEqual(con.execute("SELECT COUNT(*) FROM t").fetchone()[0], 0)
            with self.assertRaises(duckdb.Error):
                con.execute("INSERT INTO t VALUES (1)")


def run_cli(*argv):
    out, err = io.StringIO(), io.StringIO()
    with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
        code = main(list(argv))
    return code, out.getvalue(), err.getvalue()


class SampleDataTest(unittest.TestCase):
    """The data that ships in data/ must load, pass its own checks, and agree with itself across reports."""

    @classmethod
    def setUpClass(cls):
        cls.con = connect()
        cls.counts = load(cls.con)

    @classmethod
    def tearDownClass(cls):
        cls.con.close()

    def test_loads_and_passes_its_own_checks(self):
        self.assertEqual(self.counts, {"customers": 20, "products": 8, "orders": 160})
        self.assertEqual(check(self.con), [])

    def test_every_report_adds_up_to_the_same_revenue(self):
        total = self.con.execute("SELECT SUM(revenue) FROM completed_sales").fetchone()[0]
        monthly = run_report(self.con, "monthly_revenue")[1]
        self.assertEqual(sum(row[2] for row in monthly), total)
        self.assertEqual(monthly[-1][3], total, "the last running total is the grand total")
        self.assertEqual(len(monthly), 12)
        pivot = run_report(self.con, "category_by_quarter")[1]
        self.assertEqual(sum(value for row in pivot for value in row[1:] if value is not None), total)

    def test_cohorts_cover_every_customer_once(self):
        cohorts = run_report(self.con, "customer_cohorts")[1]
        self.assertEqual(sum(customers for _, months, customers in cohorts if months == 0), 20)

    def test_top_customers_are_sorted_and_start_at_rank_one(self):
        top = run_report(self.con, "top_customers")[1]
        self.assertEqual(top[0][4], 1)
        self.assertEqual([row[3] for row in top], sorted((row[3] for row in top), reverse=True))
        self.assertTrue(5 <= len(top) <= 8)

    def test_command_line(self):
        directory = Path(tempfile.mkdtemp(prefix="shop-cli-"))
        self.addCleanup(shutil.rmtree, directory, ignore_errors=True)
        db = str(directory / "w.duckdb")
        self.assertEqual(run_cli("--db", db, "report", "top_customers")[0], 2, "no warehouse yet")
        code, out, _ = run_cli("--db", db, "load")
        self.assertEqual(code, 0)
        self.assertIn("20 customers, 8 products, 160 orders", out)
        self.assertEqual(run_cli("--db", db, "check")[1].strip(), "All data checks passed.")
        code, out, _ = run_cli("--db", db, "report", "monthly_revenue", "--format", "csv")
        self.assertEqual((code, out.splitlines()[0]), (0, "month,orders,revenue,running_total,change_pct"))
        code, out, _ = run_cli("--db", db, "query", "SELECT COUNT(*) AS n FROM orders")
        self.assertEqual((code, out.split()[-1]), (0, "160"))
        self.assertEqual(run_cli("--db", db, "query", "DELETE FROM orders")[0], 1, "queries run read-only")
        self.assertEqual(run_cli("--db", db, "query", "SELEKT 1")[0], 1)
        code, _, err = run_cli("--db", db, "report", "nope")
        self.assertEqual(code, 2)
        self.assertIn("Unknown report", err)
        code, out, _ = run_cli("--db", db, "export", "--out", str(directory / "out"))
        self.assertEqual((code, out.count("Wrote")), (0, 3))
        self.assertTrue((directory / "out" / "orders.parquet").is_file())
        self.assertEqual(run_cli("--db", db, "reports")[1].split(), list_reports())

    def test_table_and_csv_formatting(self):
        self.assertEqual(format_table(["a", "bb"], [(1, None), (22, "x")]), "a   bb\n--  --\n1\n22  x")
        self.assertEqual(format_csv(["a", "b"], [(1, "x,y")]), 'a,b\n1,"x,y"')


if __name__ == "__main__":
    unittest.main()
