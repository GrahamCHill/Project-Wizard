# __PROJECT_NAME__

Ask questions about local Markdown files. Ollama embeds the passages and answers using passages retrieved from the vector database selected when you created the project. The response includes the source excerpts. See `compose.override.yaml` for the database service and its storage volume.

```sh
docker compose up --build -d --wait
docker compose exec ollama ollama pull all-minilm:22m
docker compose exec ollama ollama pull qwen2.5:0.5b
```

Open http://127.0.0.1:8080/docs and use **POST /ask** with `{"question":"How long do I have to request a refund?"}`. The stack uses the Alpine CPU-only Ollama image. The two models download about 450 MB and the first response can take a few minutes. The API, model store, and vector database run locally. Only the API accepts connections from the host.

Add short Markdown paragraphs under `docs/`. The first question indexes the current documents. Document edits or embedding-model changes create a new index and leave prior vectors in the database volume. Keep the default model names in the download commands in sync with any `EMBEDDING_MODEL` or `CHAT_MODEL` overrides in `.env`. Set `APP_PORT` there if port 8080 is in use.

Run `docker compose down` to stop the app and keep downloaded models and vectors. Add `-v` only when you want to delete both volumes.

[CPU-only Ollama image](https://hub.docker.com/r/alpine/ollama) · [Ollama embeddings](https://docs.ollama.com/api/embed)
