mod route;
mod extract;

use tokio::net::TcpListener;

#[tokio::main]
async fn main() {
    let listener = TcpListener::bind("0.0.0.0:1000").await.expect("bind failed");
    axum::serve(listener, route::create_route()).await.expect("launch failed");
}
