import json
import os
from urllib.error import URLError
from urllib.request import Request, urlopen


BASE = os.getenv("QDRANT_URL", "http://qdrant:6333")
StorageError = URLError


def request(route, payload=None, method="GET"):
    data = json.dumps(payload).encode() if payload is not None else None
    with urlopen(Request(BASE + route, data, {"Content-Type": "application/json"}, method=method), timeout=15) as response:
        return json.load(response)


def ensure_index(name, records, embed):
    collection = "/collections/" + name
    known = request("/collections")["result"]["collections"]
    exists = any(item["name"] == name for item in known)
    count = request(collection + "/points/count", {"exact": True}, "POST")["result"]["count"] if exists else 0
    if count == len(records):
        return
    vectors = embed([record["text"] for record in records])
    if not exists:
        request(collection, {"vectors": {"size": len(vectors[0]), "distance": "Cosine"}}, "PUT")
    request(collection + "/points?wait=true", {"points": [
        {"id": index, "vector": vector, "payload": record}
        for index, (vector, record) in enumerate(zip(vectors, records, strict=True), 1)
    ]}, "PUT")


def search(name, vector):
    result = request(f"/collections/{name}/points/query", {"query": vector, "limit": 3, "with_payload": True}, "POST")
    return [point["payload"] for point in result["result"]["points"]]
