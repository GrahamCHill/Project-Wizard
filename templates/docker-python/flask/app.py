import os
import sys

from flask import Flask, request


app = Flask(__name__)


@app.get("/healthz")
def health():
    return {"status": "ok"}


@app.get("/hello")
def hello():
    name = request.args.get("name") or "world"
    return {"message": f"Hello, {name}!"}


if __name__ == "__main__":
    os.execvp(sys.executable, [sys.executable, "-m", "gunicorn", "--bind", f"0.0.0.0:{os.getenv('PORT', '8080')}", "app:app"])
