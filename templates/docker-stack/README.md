# __PROJECT_NAME__

A complete Docker Compose stack: a FastAPI service, a PostgreSQL database, and Redis. The services start in order, each waits until its dependencies report healthy, and data survives restarts in named volumes.

```text
compose.yaml            The services, health checks, and volumes
compose.override.yaml   Development settings that Compose loads automatically: live reload and a database port
Dockerfile              Multi-stage build that runs the API as a non-root user
app/main.py             The API. The database and cache are injected, so tests need no services
db/init.sql             The schema, created the first time the database volume starts
tests/test_app.py       Unit tests with in-memory fakes
smoke_test.py           A check of the running stack from the outside
env.example             Settings. Copy it to .env
```

## Requirements

Docker with the Compose plugin and a running Linux container engine.

## Run it

```sh
cp env.example .env
docker compose up --build -d --wait
python smoke_test.py
```

On Windows PowerShell, copy with `Copy-Item env.example .env`. Edit `.env` and replace the password first. `--wait` returns when every service is healthy.

The API listens on `http://127.0.0.1:8000`. Open `/docs` for interactive documentation.

| Endpoint | What it does |
| --- | --- |
| `GET /healthz` | `200` when the database and Redis answer, otherwise `503` and the names of the failing ones |
| `POST /notes` | Stores a note, such as `{"text": "hello"}`, in PostgreSQL |
| `GET /notes` | Lists the newest notes. The default list is cached in Redis for 10 seconds, and the `X-Cache` header says `hit` or `miss` |
| `GET /visits` | Counts requests with a Redis counter |

```sh
docker compose logs -f api      # watch the API
docker compose exec db psql -U app -d app -c "SELECT * FROM notes"
docker compose down             # stop, keeping the data
docker compose down -v          # stop and delete the data
```

## Tests

The unit tests replace PostgreSQL and Redis with fakes, so they run in a second:

```sh
pip install -r requirements-dev.txt
python -m unittest discover -s tests
```

## Development and production

- **Development:** `docker compose up` loads `compose.override.yaml`. It mounts `app/` into the container and reloads on every edit, and publishes the database on `127.0.0.1:15432` for tools such as `psql`. It avoids 5432 so it does not clash with a PostgreSQL you already run.
- **Production:** run `docker compose -f compose.yaml up -d --build`. That skips the override, so nothing is mounted and the database is reachable only from the API.

The API container runs as a non-root user with a read-only file system, no Linux capabilities, and `no-new-privileges`. Ports are bound to `127.0.0.1`. To serve other machines, put a reverse proxy such as Caddy or Nginx in front of the API and add TLS there.

## Change the schema

`db/init.sql` runs only when the database volume is first created. For later changes, use a migration tool such as [Alembic](https://alembic.sqlalchemy.org/) or [dbmate](https://github.com/amacneil/dbmate) and run it before the new API version starts. To start over in development, run `docker compose down -v`.

## Secrets

Never commit `.env`. Git and Docker ignore it. For a real deployment, pass the password through your platform's secret store, and use a long random value:

```sh
openssl rand -base64 32
```

[Compose file reference](https://docs.docker.com/reference/compose-file/) · [FastAPI](https://fastapi.tiangolo.com/) · [psycopg](https://www.psycopg.org/psycopg3/docs/)
