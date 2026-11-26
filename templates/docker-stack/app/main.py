"""A small notes API backed by PostgreSQL, with Redis for a cache and a visit counter.

The database and cache are passed into create_app, so tests can use in-memory fakes and need no services.
"""

from __future__ import annotations

import json
import os
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Any, Protocol

from fastapi import FastAPI, Query, Response
from pydantic import BaseModel, Field, field_validator

DEFAULT_LIMIT = 20
CACHE_SECONDS = 10
NOTES_KEY = "notes:latest"


class Note(BaseModel):
    id: int
    text: str
    created_at: datetime


class NewNote(BaseModel):
    text: str = Field(min_length=1, max_length=500)

    @field_validator("text")
    @classmethod
    def not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("The note must contain more than spaces.")
        return value


class NoteStore(Protocol):
    def add(self, text: str) -> dict[str, Any]: ...
    def latest(self, limit: int) -> list[dict[str, Any]]: ...
    def ping(self) -> None: ...


class Cache(Protocol):
    def get_json(self, key: str) -> Any | None: ...
    def set_json(self, key: str, value: Any, seconds: int) -> None: ...
    def delete(self, key: str) -> None: ...
    def incr(self, key: str) -> int: ...
    def ping(self) -> None: ...


class PostgresStore:
    """Talks to PostgreSQL through a small connection pool. Every query is parameterized."""

    def __init__(self, url: str) -> None:
        from psycopg.rows import dict_row
        from psycopg_pool import ConnectionPool

        self.pool = ConnectionPool(url, min_size=1, max_size=5, open=False, kwargs={"row_factory": dict_row})

    def open(self) -> None:
        self.pool.open(wait=True, timeout=15)

    def close(self) -> None:
        self.pool.close()

    def add(self, text: str) -> dict[str, Any]:
        with self.pool.connection() as connection:
            return connection.execute(
                "INSERT INTO notes (text) VALUES (%s) RETURNING id, text, created_at", (text,)).fetchone()

    def latest(self, limit: int) -> list[dict[str, Any]]:
        with self.pool.connection() as connection:
            return connection.execute(
                "SELECT id, text, created_at FROM notes ORDER BY created_at DESC, id DESC LIMIT %s", (limit,)).fetchall()

    def ping(self) -> None:
        with self.pool.connection() as connection:
            connection.execute("SELECT 1")


class RedisCache:
    def __init__(self, url: str) -> None:
        import redis

        self.client = redis.Redis.from_url(url, socket_timeout=3, socket_connect_timeout=3, decode_responses=True)

    def get_json(self, key: str) -> Any | None:
        raw = self.client.get(key)
        return None if raw is None else json.loads(raw)

    def set_json(self, key: str, value: Any, seconds: int) -> None:
        self.client.set(key, json.dumps(value), ex=seconds)

    def delete(self, key: str) -> None:
        self.client.delete(key)

    def incr(self, key: str) -> int:
        return int(self.client.incr(key))

    def ping(self) -> None:
        self.client.ping()

    def close(self) -> None:
        self.client.close()


def create_app(store: NoteStore | None = None, cache: Cache | None = None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        owned: list[Any] = []
        if store is None:
            real_store = PostgresStore(os.environ["DATABASE_URL"])
            real_store.open()
            owned.append(real_store)
            app.state.store = real_store
        if cache is None:
            real_cache = RedisCache(os.environ["REDIS_URL"])
            owned.append(real_cache)
            app.state.cache = real_cache
        yield
        for resource in owned:
            resource.close()

    app = FastAPI(title="__PROJECT_NAME__", lifespan=lifespan)
    app.state.store = store
    app.state.cache = cache

    @app.get("/healthz")
    def healthz(response: Response) -> dict[str, Any]:
        failing = []
        for name, dependency in (("database", app.state.store), ("cache", app.state.cache)):
            try:
                dependency.ping()
            except Exception:  # any failure means this dependency is not usable right now
                failing.append(name)
        if failing:
            response.status_code = 503
            return {"status": "unavailable", "failing": failing}
        return {"status": "ok"}

    @app.post("/notes", status_code=201, response_model=Note)
    def add_note(note: NewNote) -> dict[str, Any]:
        created = app.state.store.add(note.text)
        app.state.cache.delete(NOTES_KEY)  # the cached list is out of date now
        return created

    @app.get("/notes", response_model=list[Note])
    def list_notes(response: Response, limit: int = Query(DEFAULT_LIMIT, ge=1, le=100)) -> Any:
        # Only the default list is cached, so one key is enough to invalidate when a note is added.
        if limit == DEFAULT_LIMIT:
            cached = app.state.cache.get_json(NOTES_KEY)
            if cached is not None:
                response.headers["X-Cache"] = "hit"
                return cached
        notes = [Note.model_validate(row).model_dump(mode="json") for row in app.state.store.latest(limit)]
        if limit == DEFAULT_LIMIT:
            app.state.cache.set_json(NOTES_KEY, notes, CACHE_SECONDS)
        response.headers["X-Cache"] = "miss"
        return notes

    @app.get("/visits")
    def visits() -> dict[str, int]:
        return {"visits": app.state.cache.incr("visits")}

    return app


app = create_app()
