# __PROJECT_NAME__

Run a local Qdrant database, insert two sample vectors, and query the nearest match.

```sh
docker compose up -d qdrant
docker compose run --rm demo
```

The demo prints the gardening vector and its similarity score. Open the dashboard at http://127.0.0.1:6333/dashboard. Set `QDRANT_PORT` in a local `.env` file if port 6333 is in use.

`docker compose down` stops Qdrant and keeps the named volume. `docker compose down -v` also deletes the stored vectors. The local dashboard listens only on loopback. Configure Qdrant authentication before exposing it to other hosts.
