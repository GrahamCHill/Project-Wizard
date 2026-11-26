"""Checks a running stack from the outside, through the same port a browser would use.

    docker compose up --build -d --wait
    python smoke_test.py

It needs only the Python standard library. Set APP_PORT, or pass a URL, if you changed the port.
"""

import json
import os
import sys
import urllib.error
import urllib.request

BASE = (sys.argv[1] if len(sys.argv) > 1 else f"http://127.0.0.1:{os.environ.get('APP_PORT', '8000')}").rstrip("/")


def call(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(BASE + path, data=data, method=method, headers={"content-type": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            return response.status, response.headers, json.load(response)
    except urllib.error.HTTPError as error:
        return error.code, error.headers, json.load(error)


def check(label, condition, detail=""):
    print(("ok   " if condition else "FAIL ") + label + (f"  {detail}" if detail and not condition else ""))
    if not condition:
        sys.exit(1)


status, _, body = call("GET", "/healthz")
check("database and cache are healthy", status == 200 and body == {"status": "ok"}, f"{status} {body}")

status, _, note = call("POST", "/notes", {"text": "smoke test"})
check("creates a note", status == 201 and note["text"] == "smoke test", f"{status} {note}")

status, headers, notes = call("GET", "/notes")
check("lists the note after creating it", status == 200 and notes[0]["id"] == note["id"], f"{status} {notes[:1]}")
check("the first read comes from the database", headers.get("X-Cache") == "miss", str(headers))
_, headers, _ = call("GET", "/notes")
check("the second read comes from Redis", headers.get("X-Cache") == "hit", str(headers))

status, _, _ = call("POST", "/notes", {"text": ""})
check("rejects an empty note", status == 422, str(status))

_, _, first = call("GET", "/visits")
_, _, second = call("GET", "/visits")
check("counts visits in Redis", second["visits"] == first["visits"] + 1, f"{first} {second}")
print("All checks passed.")
