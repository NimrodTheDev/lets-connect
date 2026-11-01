use axum::{Extension, Json};
use axum::http::StatusCode;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;
use crate::extract::data::ApiJson;
use crate::route::{hash_session, AppState, Settings};

#[derive(Deserialize, Debug, Validate)]
pub struct SignUpPayload {
    #[validate(email(message = "email must be a valid email"))]
    pub email: String,
    #[validate(length(min=8, message = "password must be at least 8 characters"))]
    pub password: String,
}

#[derive(Deserialize, Serialize, Debug, Validate)]
pub struct LoginResponse {
    pub email: String,
    pub success: bool,
    pub session: String,
}
pub async fn sign_up(Extension(ext): Extension<AppState>, ApiJson(payload): ApiJson<SignUpPayload>)-> Result<StatusCode, StatusCode>{
    let mut value = ext.users.lock().await;
    let exists = value.iter().any(|(email, _)| email == &payload.email);
    if exists {
        // 409: an account with this email already exists.
        Err(StatusCode::CONFLICT)
    }else{
        ext.settings.lock().await.insert(payload.email.clone(), Settings{
            display_name: None,
            email: payload.email.clone(),
            avatar_url: None,
            interests: None,
            onboarded: false,
            radius_km: 0,
            tags: None,
            live_until: None,
            one_liner: None,
            approximate_location: false,
            status: None,
            can_ask_again: false,
            is_live: false,
            onboarding_completed: false,
            onboarding_next_step: None,
            last_seen_at: None,
        });
        value.push((payload.email, payload.password));
        Ok(StatusCode::CREATED)
    }
}


pub async fn login(Extension(ext): Extension<AppState>, ApiJson(payload): ApiJson<SignUpPayload>)->Result<Json<LoginResponse>, StatusCode>{
    let value = ext.users.lock().await;
    let valid = value
        .iter()
        .any(|(email, password)| email == &payload.email && password == &payload.password);
    if valid {
        let session = Uuid::new_v4();
        ext.sessions.lock().await.insert(payload.email.clone(), hash_session(&session));
        Ok(Json(LoginResponse{
            email: payload.email.clone(),
            success: true,
            session: session.to_string(),
        }))
    }else{
        // Same response for unknown email and wrong password, so the API
        // doesn't reveal which emails have accounts.
        Err(StatusCode::UNAUTHORIZED)
    }
}
