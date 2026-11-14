use axum::{Json, Router, extract::Query, routing::get};
use serde::Deserialize;
use serde_json::{Value, json};
use tokio::net::TcpListener;

#[derive(Deserialize)]
struct Greeting {
    name: Option<String>,
}

async fn health() -> Json<Value> {
    Json(json!({"status": "ok"}))
}

async fn hello(Query(query): Query<Greeting>) -> Json<Value> {
    let name = query.name.as_deref().filter(|value| !value.is_empty()).unwrap_or("world");
    Json(json!({"message": format!("Hello, {name}!")}))
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let port = std::env::var("PORT").unwrap_or_else(|_| "8080".to_owned());
    let listener = TcpListener::bind(format!("0.0.0.0:{port}")).await?;
    let app = Router::new().route("/healthz", get(health)).route("/hello", get(hello));
    axum::serve(listener, app).await
}
