use std::time::Duration;
use axum::{Extension, http::StatusCode};
use chrono::Utc;
use tokio::time::{interval, MissedTickBehavior};

use crate::extract::current_user::CurrentUser;
use crate::route::AppState;

pub async fn live_pool(
    Extension(app_state): Extension<AppState>,
    CurrentUser { email }: CurrentUser,
) -> StatusCode {
    let now = Utc::now().timestamp();

    let mut settings = app_state.settings.lock().await;

    if let Some(setting) = settings.get_mut(&email) {
        // Only accept heartbeats during an active live session.
        if setting.live_until.is_some_and(|expiry| expiry as i64 > now) {
            setting.last_seen_at = Some(now);
            setting.is_live = true;
            StatusCode::NO_CONTENT
        } else {
            setting.is_live = false;
            setting.last_seen_at = None;
            StatusCode::FORBIDDEN
        }
    } else {
        StatusCode::NOT_FOUND
    }
}

pub async fn check_last_seen(app_state: AppState) {
    let mut ticker = interval(Duration::from_secs(10));
    ticker.set_missed_tick_behavior(MissedTickBehavior::Skip);

    loop {
        ticker.tick().await;

        let now = Utc::now().timestamp();

        let mut settings = app_state.settings.lock().await;

        for setting in settings.values_mut() {
            let expired = setting
                .live_until
                .is_some_and(|expiry| now >= expiry as i64);

            let heartbeat_expired = setting
                .last_seen_at
                .is_none_or(|last_seen| now - last_seen > 90);

            if expired {
                setting.is_live = false;
                setting.last_seen_at = None;
                setting.live_until = None;
            } else if heartbeat_expired {
                setting.is_live = false;
                setting.last_seen_at = None;
            }
        }
    }
}