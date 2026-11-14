import os

from fastapi import FastAPI
import uvicorn


app = FastAPI(title="__PROJECT_NAME__")


@app.get("/healthz")
def health():
    return {"status": "ok"}


@app.get("/hello")
def hello(name: str = "world"):
    return {"message": f"Hello, {name}!"}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8080")))
