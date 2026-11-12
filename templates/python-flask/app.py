from flask import Flask, jsonify


def create_app():
    app = Flask(__name__)

    @app.get("/")
    def home():
        return jsonify(message="Hello from __PROJECT_NAME__!")

    @app.get("/health")
    def health():
        return jsonify(status="ok")

    return app
