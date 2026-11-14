# __PROJECT_NAME__

Serve an ONNX model with FastAPI and ONNX Runtime on a CPU. The Docker build trains and exports a small Iris classifier for the example.

```sh
docker compose up --build -d --wait
curl -H "Content-Type: application/json" --data-binary @predict.json http://127.0.0.1:8080/predict
```

Use `curl.exe` on Windows if PowerShell maps `curl` to another command. Open http://127.0.0.1:8080/docs for an interactive client. `GET /model` shows the tensor names, types, and shapes expected by `POST /predict`.

## Load your model

Copy your trained model into `models/` and add `MODEL_PATH=/models/my-model.onnx` to `.env`. To load from cloud storage, instead add `MODEL_URL` and `MODEL_SHA256` to `.env`. Compose passes these settings to the container. Run `docker compose up -d --wait` again to apply changes. A remote file can be up to 512 MiB. The URL must be accessible to the container. Use an authorized HTTPS download URL for private storage.

This starter accepts float32, float64, int32, and int64 tensors as model inputs and outputs. Use integer JSON values where the input type is integer. Use a single ONNX file with embedded weights from a trusted source.

## Deploy the container

Build the image and push it to your registry.

```sh
docker build -t REGISTRY/onnx-api:0.1.0 .
docker push REGISTRY/onnx-api:0.1.0
```

Replace `REGISTRY` with the registry and repository namespace you use. Deploy the image as an HTTP container, for example to an authenticated Cloud Run service. The server listens on `0.0.0.0` and honors `PORT`, defaulting to 8080. Configure a startup probe on `/healthz`, which responds after the model loads. Configure authentication and request limits on the hosting service. Set model variables as runtime configuration and allow startup time for remote downloads.

`docker compose down` stops the local service. Set `APP_PORT` in a local `.env` file if port 8080 is in use.

[ONNX Runtime](https://onnxruntime.ai/docs/api/python/api_summary.html) · [Cloud Run container contract](https://cloud.google.com/run/docs/container-contract)
