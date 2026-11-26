"""Tests the API with in-memory fakes, so no database or Redis is needed.

Install the test dependencies with `pip install -r requirements-dev.txt`, then run
`python -m unittest discover -s tests`. In the development containers: `docker compose run --rm --no-deps api python -m unittest discover -s tests`
(add httpx to the image first, or run the tests on your computer).
"""

import unittest
from datetime import datetime, timezone

from fastapi.testclient import TestClient

from app.main import CACHE_SECONDS, DEFAULT_LIMIT, create_app


class FakeStore:
    def __init__(self):
        self.rows, self.healthy = [], True

    def add(self, text):
        row = {"id": len(self.rows) + 1, "text": text, "created_at": datetime(2026, 1, 1, tzinfo=timezone.utc)}
        self.rows.append(row)
        return row

    def latest(self, limit):
        return list(reversed(self.rows))[:limit]

    def ping(self):
        if not self.healthy:
            raise ConnectionError("database is down")


class FakeCache:
    def __init__(self):
        self.values, self.expiries, self.healthy = {}, {}, True

    def get_json(self, key):
        return self.values.get(key)

    def set_json(self, key, value, seconds):
        self.values[key], self.expiries[key] = value, seconds

    def delete(self, key):
        self.values.pop(key, None)

    def incr(self, key):
        self.values[key] = self.values.get(key, 0) + 1
        return self.values[key]

    def ping(self):
        if not self.healthy:
            raise ConnectionError("cache is down")


class ApiTest(unittest.TestCase):
    def setUp(self):
        self.store, self.cache = FakeStore(), FakeCache()
        self.client = TestClient(create_app(self.store, self.cache))

    def test_health_reports_ok_when_both_dependencies_answer(self):
        response = self.client.get("/healthz")
        self.assertEqual((response.status_code, response.json()), (200, {"status": "ok"}))

    def test_health_names_the_dependency_that_failed(self):
        self.store.healthy = False
        response = self.client.get("/healthz")
        self.assertEqual((response.status_code, response.json()), (503, {"status": "unavailable", "failing": ["database"]}))
        self.cache.healthy = False
        self.assertEqual(self.client.get("/healthz").json()["failing"], ["database", "cache"])

    def test_adds_and_lists_notes_newest_first(self):
        created = self.client.post("/notes", json={"text": "  first  "})
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.json()["text"], "first", "the text is trimmed")
        self.client.post("/notes", json={"text": "second"})
        notes = self.client.get("/notes").json()
        self.assertEqual([note["text"] for note in notes], ["second", "first"])
        self.assertEqual(notes[0]["created_at"], "2026-01-01T00:00:00Z")

    def test_rejects_bad_notes(self):
        for body in [{}, {"text": ""}, {"text": "   "}, {"text": "x" * 501}, {"text": 5}, {"text": None}]:
            self.assertEqual(self.client.post("/notes", json=body).status_code, 422, body)
        self.assertEqual(self.store.rows, [])

    def test_caches_the_default_list_until_a_note_is_added(self):
        self.client.post("/notes", json={"text": "one"})
        first = self.client.get("/notes")
        second = self.client.get("/notes")
        self.assertEqual((first.headers["x-cache"], second.headers["x-cache"]), ("miss", "hit"))
        self.assertEqual(second.json(), first.json())
        self.assertEqual(self.cache.expiries["notes:latest"], CACHE_SECONDS)
        self.client.post("/notes", json={"text": "two"})
        after = self.client.get("/notes")
        self.assertEqual(after.headers["x-cache"], "miss")
        self.assertEqual(len(after.json()), 2)

    def test_does_not_cache_other_limits(self):
        for text in ["a", "b", "c"]:
            self.client.post("/notes", json={"text": text})
        response = self.client.get("/notes", params={"limit": 2})
        self.assertEqual((response.headers["x-cache"], len(response.json())), ("miss", 2))
        self.assertNotIn("notes:latest", self.cache.values)

    def test_limits_are_validated(self):
        for limit in [0, -1, 101, "many"]:
            self.assertEqual(self.client.get("/notes", params={"limit": limit}).status_code, 422, limit)
        self.assertEqual(self.client.get("/notes", params={"limit": 100}).status_code, 200)
        self.assertEqual(DEFAULT_LIMIT, 20)

    def test_counts_visits(self):
        self.assertEqual([self.client.get("/visits").json()["visits"] for _ in range(3)], [1, 2, 3])


if __name__ == "__main__":
    unittest.main()
