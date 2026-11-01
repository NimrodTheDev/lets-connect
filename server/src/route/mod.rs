mod health;
mod auth;
mod user;
pub mod live;

use std::collections::HashMap;
use std::hash::{DefaultHasher, Hash, Hasher};
use std::sync::Arc;
use axum::http::Method;
use axum::{Extension, Router};
use axum::routing::{get, post};
use serde::{Deserialize, Serialize};
use tokio::sync::Mutex;
use tower_http::cors::{Any, CorsLayer};
use uuid::Uuid;
use crate::route::live::{check_last_seen, live_pool};

#[derive(Default, Serialize, Clone)]
pub struct Settings {
    pub display_name: Option<String>,
    pub email: String,
    pub avatar_url: Option<String>,
    pub interests: Option<Vec<String>>,
    pub onboarded: bool,
    pub radius_km: usize,
    pub tags: Option<Vec<String>>,
    pub live_until: Option<usize>,
    pub one_liner: Option<String>,
    pub approximate_location: bool,
    pub status: Option<String>,
    pub can_ask_again: bool,
    pub is_live: bool,
    pub onboarding_completed: bool,
    pub onboarding_next_step: Option<String>,
    pub last_seen_at: Option<i64>,
}



#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Location {
    pub latitude: f64,
    pub longitude: f64,
    pub accuracy: Option<f64>,
    pub timestamp: i64,
}

#[derive(Clone, Default)]
pub struct AppState{
    pub users: Arc<Mutex<Vec<(String, String)>>>,
    // email -> hashed session token (one session per user)
    pub sessions: Arc<Mutex<HashMap<String, String>>>,
    pub settings: Arc<Mutex<HashMap<String, Settings>>>,
    pub locations: Arc<Mutex<HashMap<String, Location>>>,
}
impl AppState {
    pub async fn create(self, arg: (String, String)){
        self.users.lock().await.push(arg.clone());
        let mut setting = Settings::default();
        setting.email = arg.0.clone();
        self.settings.lock().await.insert(arg.0.clone(), setting);
        
    }
}
// Hashes a session token before it's stored or looked up.
// DefaultHasher is fine for learning; switch to SHA-256 with the database.
pub fn hash_session(token: &Uuid) -> String {
    let mut hasher = DefaultHasher::new();
    token.hash(&mut hasher);
    hasher.finish().to_string()
}

pub fn create_route() ->Router<()>{
    let cors = CorsLayer::new().allow_methods([Method::GET, Method::POST]).allow_origin(Any) ;
    let state = AppState::default();
    tokio::spawn(check_last_seen(state.clone()));
    let protected: Router<()> = Router::new()
        .route("/me", get(user::me))
        .route("/logout", post(user::logout))
        .route("/settings", get(user::settings).post(user::edit_settings))
        .route("/location", post(user::post_location).get(user::get_location_nearby))
        .route("/live", post(live_pool));

    Router::new()
        .merge(protected)
        .route("/health", get(health::health))
        .route("/signup", post(auth::sign_up))
        .route("/login",post(auth::login))
        .layer(cors)
        .layer(Extension(state))

}
