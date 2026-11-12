from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="__PROJECT_NAME__")


class Addition(BaseModel):
    left: float
    right: float


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/add")
def add(values: Addition):
    return {"result": values.left + values.right}
