use std::str::FromStr;
use axum::extract::FromRequestParts;
use axum::http::request::Parts;
use axum::http::{header, StatusCode};
use uuid::Uuid;
use crate::route::{hash_session, AppState};

pub struct CurrentUser{
    pub email: String,
}

impl<S: Send + Sync> FromRequestParts<S> for CurrentUser {
    type Rejection = (StatusCode, String);

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let token = parts.headers.get(header::AUTHORIZATION)
            .and_then(|h| h.to_str().ok())
            .and_then(|h| h.strip_prefix("Bearer "))
            .ok_or((StatusCode::UNAUTHORIZED, "Missing bearer token".to_owned()))?;

        let uuid = Uuid::from_str(token)
            .map_err(|_| (StatusCode::UNAUTHORIZED, "Invalid session".to_owned()))?;
        let hashed = hash_session(&uuid);

        let state = parts.extensions.get::<AppState>().cloned()
            .ok_or((StatusCode::INTERNAL_SERVER_ERROR, "AppState missing".to_owned()))?;

        // sessions is email -> hash, so find the email whose hash matches
        let sessions = state.sessions.lock().await;
        let email = sessions.iter()
            .find(|(_, h)| **h == hashed)
            .map(|(email, _)| email.clone())
            .ok_or((StatusCode::UNAUTHORIZED, "Invalid session".to_owned()))?;

        Ok(Self{ email })
    }
}
