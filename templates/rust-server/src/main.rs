use axum::{routing::get, Json, Router};
use serde_json::json;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let app = Router::new().route("/", get(|| async {
        Json(json!({"message": "Hello from __PROJECT_NAME__!"}))
    }));

    let listener = tokio::net::TcpListener::bind("127.0.0.1:8080").await?;
    println!("Listening on http://127.0.0.1:8080");
    axum::serve(listener, app).await
}
