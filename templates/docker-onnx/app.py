import hashlib
import hmac
import os
import re
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, build_opener

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import numpy as np
import onnxruntime as ort
from onnxruntime.capi.onnxruntime_pybind11_state import InvalidArgument
import uvicorn


MAX_MODEL_BYTES = 512 * 1024 * 1024
DTYPES = {
    "tensor(float)": np.float32,
    "tensor(double)": np.float64,
    "tensor(int32)": np.int32,
    "tensor(int64)": np.int64,
}


class HttpsRedirects(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if urlsplit(newurl).scheme != "https":
            raise ValueError("The model URL redirected to a non-HTTPS URL.")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def model_source():
    url = os.getenv("MODEL_URL")
    path = os.getenv("MODEL_PATH")
    if url and path:
        raise ValueError("Configure either MODEL_URL or MODEL_PATH.")
    if not url:
        return str(Path(path) if path else Path(__file__).parent / "sample.onnx")
    digest = os.getenv("MODEL_SHA256", "").lower()
    if urlsplit(url).scheme != "https" or not re.fullmatch(r"[a-f0-9]{64}", digest):
        raise ValueError("A remote model requires an HTTPS MODEL_URL and a MODEL_SHA256 checksum.")
    with build_opener(HttpsRedirects()).open(url, timeout=30) as response:
        data = response.read(MAX_MODEL_BYTES + 1)
    if len(data) > MAX_MODEL_BYTES or not hmac.compare_digest(hashlib.sha256(data).hexdigest(), digest):
        raise ValueError("Remote model exceeded the size limit or failed its SHA-256 check.")
    return data


@asynccontextmanager
async def lifespan(app):
    session = ort.InferenceSession(model_source(), providers=["CPUExecutionProvider"])
    if any(spec.type not in DTYPES for spec in [*session.get_inputs(), *session.get_outputs()]):
        raise ValueError("This API expects float32, float64, int32, or int64 tensor inputs and outputs.")
    app.state.model = session
    yield


app = FastAPI(title="__PROJECT_NAME__", lifespan=lifespan)


class Prediction(BaseModel):
    inputs: dict[str, list]


@app.get("/healthz")
def health():
    return {"status": "ok"}


@app.get("/model")
def signature():
    return {"inputs": [
        {"name": spec.name, "dtype": spec.type, "shape": spec.shape}
        for spec in app.state.model.get_inputs()
    ]}


@app.post("/predict")
def predict(body: Prediction):
    session = app.state.model
    specs = session.get_inputs()
    if body.inputs.keys() != {spec.name for spec in specs}:
        raise HTTPException(status_code=422, detail="Supply the exact input names listed at /model.")
    try:
        tensors = {}
        for spec in specs:
            data = np.asarray(body.inputs[spec.name])
            expected = np.dtype(DTYPES[spec.type])
            if data.dtype.kind not in ("iuf" if expected.kind == "f" else "iu"):
                raise ValueError(f"{spec.name} expects {spec.type} values.")
            if expected.kind in "iu" and data.size:
                limits = np.iinfo(expected)
                if int(data.min()) < limits.min or int(data.max()) > limits.max:
                    raise ValueError(f"{spec.name} has an out-of-range integer.")
            with np.errstate(over="raise", invalid="raise"):
                values = data.astype(expected)
            if not np.isfinite(values).all():
                raise ValueError(f"{spec.name} contains non-finite values.")
            tensors[spec.name] = values
        outputs = session.run(None, tensors)
    except (ValueError, TypeError, OverflowError, FloatingPointError, InvalidArgument) as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    if any(not np.isfinite(output).all() for output in outputs):
        raise HTTPException(status_code=422, detail="The model produced a non-finite result.")
    return {"outputs": {spec.name: output.tolist() for spec, output in zip(session.get_outputs(), outputs, strict=True)}}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8080")))
