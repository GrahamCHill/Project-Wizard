"""Unit tests for the handler. They replace DynamoDB with a fake table, so they need no AWS account or boto3.

    python -m unittest discover -s tests
"""

import json
import sys
import unittest
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

import app  # noqa: E402


class FakeTable:
    def __init__(self):
        self.items = {}
        self.fail = False

    def scan(self, Limit):
        return {"Items": list(self.items.values())[:Limit]}

    def put_item(self, Item, ConditionExpression):
        if self.fail:
            raise RuntimeError("DynamoDB is unavailable")
        assert ConditionExpression == "attribute_not_exists(id)"
        self.items[Item["id"]] = Item

    def get_item(self, Key):
        item = self.items.get(Key["id"])
        return {"Item": item} if item else {}


def event(method, path, body=None, params=None):
    return {"requestContext": {"http": {"method": method}}, "rawPath": path, "body": body, "pathParameters": params or {}}


class HandlerTest(unittest.TestCase):
    def setUp(self):
        self.table = FakeTable()
        app._table = self.table
        self.addCleanup(setattr, app, "_table", None)

    def call(self, *args, **kwargs):
        result = app.handler(event(*args, **kwargs))
        return result["statusCode"], json.loads(result["body"]), result

    def test_creates_and_reads_an_item(self):
        status, created, result = self.call("POST", "/items", json.dumps({"name": "  First  "}))
        self.assertEqual(status, 201)
        self.assertEqual(created["name"], "First")
        self.assertEqual(result["headers"]["content-type"], "application/json")
        status, found, _ = self.call("GET", f"/items/{created['id']}", params={"id": created["id"]})
        self.assertEqual((status, found), (200, created))

    def test_ids_are_unique(self):
        ids = {self.call("POST", "/items", json.dumps({"name": "x"}))[1]["id"] for _ in range(20)}
        self.assertEqual(len(ids), 20)

    def test_lists_items_up_to_the_limit(self):
        for index in range(app.LIST_LIMIT + 5):
            self.table.items[str(index)] = {"id": str(index), "name": "n"}
        status, body, _ = self.call("GET", "/items")
        self.assertEqual((status, len(body["items"])), (200, app.LIST_LIMIT))

    def test_rejects_bad_bodies(self):
        cases = [None, "not json", "[]", "{}", json.dumps({"name": ""}), json.dumps({"name": "   "}), json.dumps({"name": 5}),
                 json.dumps({"name": "x" * (app.MAX_NAME_LENGTH + 1)}), "x" * (app.MAX_BODY_BYTES + 1)]
        for body in cases:
            status, error, _ = self.call("POST", "/items", body)
            self.assertEqual(status, 400, body)
            self.assertIn("error", error)
        self.assertEqual(self.table.items, {})

    def test_accepts_the_longest_allowed_name(self):
        status, item, _ = self.call("POST", "/items", json.dumps({"name": "x" * app.MAX_NAME_LENGTH}))
        self.assertEqual((status, len(item["name"])), (201, app.MAX_NAME_LENGTH))

    def test_unknown_item_and_unknown_routes_are_404(self):
        self.assertEqual(self.call("GET", "/items/nope", params={"id": "nope"})[0], 404)
        self.assertEqual(self.call("GET", "/other")[0], 404)
        self.assertEqual(self.call("DELETE", "/items")[0], 404)
        self.assertEqual(app.handler({})["statusCode"], 404)

    def test_failures_are_logged_and_hidden_from_the_caller(self):
        self.table.fail = True
        with self.assertLogs(level="ERROR"):
            status, body, _ = self.call("POST", "/items", json.dumps({"name": "x"}))
        self.assertEqual((status, body), (500, {"error": "Something went wrong."}))

    def test_numbers_from_dynamodb_are_written_as_json_numbers(self):
        self.table.items["a"] = {"id": "a", "count": Decimal("3"), "ratio": Decimal("1.5")}
        _, body, _ = self.call("GET", "/items")
        self.assertEqual(body["items"][0], {"id": "a", "count": 3, "ratio": 1.5})


if __name__ == "__main__":
    unittest.main()
