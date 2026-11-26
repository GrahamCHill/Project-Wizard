"""Lambda handler for a small items API behind an API Gateway HTTP API (payload format 2.0).

    GET  /items        list items
    POST /items        create an item from {"name": "..."}
    GET  /items/{id}   read one item

boto3 is imported lazily and the table comes from get_table(), so tests can replace the table with a fake.
"""

from __future__ import annotations

import json
import logging
import os
import uuid
from decimal import Decimal
from typing import Any

logger = logging.getLogger()
logger.setLevel(os.environ.get("LOG_LEVEL", "INFO"))

MAX_NAME_LENGTH = 100
LIST_LIMIT = 50
MAX_BODY_BYTES = 10_000

_table = None


def get_table():
    global _table
    if _table is None:
        import boto3

        _table = boto3.resource("dynamodb").Table(os.environ["TABLE_NAME"])
    return _table


def _default(value: Any) -> Any:
    # DynamoDB returns numbers as Decimal, which the json module cannot write.
    if isinstance(value, Decimal):
        return int(value) if value == value.to_integral_value() else float(value)
    raise TypeError(f"Cannot serialize {type(value).__name__}")


def response(status: int, body: Any) -> dict[str, Any]:
    return {
        "statusCode": status,
        "headers": {"content-type": "application/json"},
        "body": json.dumps(body, default=_default),
    }


def list_items() -> dict[str, Any]:
    result = get_table().scan(Limit=LIST_LIMIT)
    return response(200, {"items": result.get("Items", [])})


def create_item(raw_body: str | None) -> dict[str, Any]:
    if raw_body is None or len(raw_body.encode()) > MAX_BODY_BYTES:
        return response(400, {"error": "Send a JSON body of at most 10 KB."})
    try:
        data = json.loads(raw_body)
    except json.JSONDecodeError:
        return response(400, {"error": "The body is not valid JSON."})
    name = data.get("name") if isinstance(data, dict) else None
    if not isinstance(name, str) or not 1 <= len(name.strip()) <= MAX_NAME_LENGTH:
        return response(400, {"error": f"'name' must be text of 1 to {MAX_NAME_LENGTH} characters."})
    item = {"id": str(uuid.uuid4()), "name": name.strip()}
    # The condition makes the write fail instead of silently replacing an item, in the unlikely case of an id clash.
    get_table().put_item(Item=item, ConditionExpression="attribute_not_exists(id)")
    return response(201, item)


def get_item(item_id: str) -> dict[str, Any]:
    item = get_table().get_item(Key={"id": item_id}).get("Item")
    return response(200, item) if item else response(404, {"error": "No item has that id."})


def handler(event: dict[str, Any], _context: Any = None) -> dict[str, Any]:
    http = event.get("requestContext", {}).get("http", {})
    method, path = http.get("method", ""), event.get("rawPath", "")
    logger.info("%s %s", method, path)
    try:
        if path == "/items" and method == "GET":
            return list_items()
        if path == "/items" and method == "POST":
            return create_item(event.get("body"))
        if method == "GET" and path.startswith("/items/"):
            return get_item(event.get("pathParameters", {}).get("id") or path.removeprefix("/items/"))
    except Exception:
        # Log the details for yourself, and tell the caller nothing about the internals.
        logger.exception("Unhandled error")
        return response(500, {"error": "Something went wrong."})
    return response(404, {"error": "Not found."})
