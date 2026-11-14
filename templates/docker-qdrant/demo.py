import json
import os
import time
from urllib.error import URLError
from urllib.request import Request, urlopen


URL = os.environ.get("QDRANT_URL", "http://127.0.0.1:6333")
COLLECTION = "/collections/starter_vectors"


def request(route, payload=None, method="GET"):
    data = json.dumps(payload).encode() if payload is not None else None
    with urlopen(Request(URL + route, data, {"Content-Type": "application/json"}, method=method), timeout=5) as response:
        return json.load(response)


def main():
    for attempt in range(30):
        try:
            collections = request("/collections")["result"]["collections"]
            break
        except (URLError, TimeoutError):
            if attempt == 29:
                raise
            time.sleep(1)
    if not any(collection["name"] == "starter_vectors" for collection in collections):
        request(COLLECTION, {"vectors": {"size": 3, "distance": "Cosine"}}, "PUT")
    request(COLLECTION + "/points?wait=true", {"points": [
        {"id": 1, "vector": [1.0, 0.0, 0.0], "payload": {"topic": "gardening"}},
        {"id": 2, "vector": [0.0, 1.0, 0.0], "payload": {"topic": "astronomy"}},
    ]}, "PUT")
    result = request(COLLECTION + "/points/query", {"query": [0.9, 0.1, 0.0], "limit": 1, "with_payload": True}, "POST")
    print(json.dumps(result["result"]["points"], indent=2))


if __name__ == "__main__":
    main()
