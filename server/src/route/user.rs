use axum::{Extension, Json};
use axum::http::StatusCode;
use serde::{Deserialize, Serialize};
use tokio::io::Interest;
use crate::extract::current_user::CurrentUser;
use crate::route::{AppState, Location, Settings};


#[derive(Default, Serialize)]
pub struct MeResponse {
    pub email: String,
    pub display_name: Option<String>,
    pub avatar_url: Option<String>,
    pub onboarding_completed: bool,
    pub onboarding_next_step: Option<String>,
}

#[derive(Default, Serialize, Deserialize, Clone)]
pub struct SettingsResponse {
    pub display_name: String,
    pub email: String,
    pub avatar_url: String,
    pub interests: Vec<String>,
    pub onboarded: bool,
    pub radius_km: usize,
    pub tags: Vec<String>,
    pub live_until: Option<usize>,
    pub one_liner: String,
    pub approximate_location: bool,
    pub status: String,
    pub can_ask_again: bool,
    pub available: bool,
    pub is_live: bool,
    pub onboarding_completed: bool,
    pub onboarding_next_step: Option<String>,
}


#[derive(Debug, Deserialize, Serialize)]
pub struct EditSettingsRequest {
    pub display_name: Option<String>,
    pub avatar_url: Option<String>,
    pub interests: Option<Vec<String>>,
    pub radius_km: Option<usize>,
    pub tags: Option<Vec<String>>,
    pub one_liner: Option<String>,
    pub approximate_location: Option<bool>,
    pub status: Option<String>,
    pub available: Option<bool>,
    pub is_live: Option<bool>,
    pub onboarding_completed: Option<bool>,
    pub live_until: Option<usize>,
}

pub async fn me(Extension(ext): Extension<AppState>,CurrentUser {
  email,
}: CurrentUser) -> Result<Json<MeResponse>, StatusCode> {
    let settings = ext.settings.lock().await;
    let Some(setting) = settings.get(&email) else { return Err(StatusCode::BAD_REQUEST); };
    Ok(Json(MeResponse{
        email,
        display_name: setting.display_name.clone(),
        avatar_url: setting.avatar_url.clone(),
        onboarding_completed: setting.onboarding_completed,
        onboarding_next_step: setting.onboarding_next_step.clone(),
    }))
}

pub async fn logout(Extension(ext): Extension<AppState>, user: CurrentUser) -> StatusCode {
    ext.sessions.lock().await.remove(&user.email);
    StatusCode::NO_CONTENT
}

pub async fn settings(Extension(ext): Extension<AppState>, CurrentUser{
    email
}: CurrentUser) -> Result<Json<Settings>, (StatusCode, String)> {
    let settings = ext.settings.lock().await;
    let setting = settings.get(email.as_str());
    if let Some(setting) = setting {
        Ok(Json(
            setting.clone()
        ))
    }else {
        Err((StatusCode::BAD_REQUEST, "Email does not exist".to_string()))
    }
}

pub async fn edit_settings(Extension(ext): Extension<AppState>, CurrentUser{
    email
}: CurrentUser, Json(req): Json<EditSettingsRequest>) -> Result<Json<Settings>, (StatusCode, String)> {
    let mut settings = ext.settings.lock().await;
    let setting = settings.get_mut(email.as_str());
    if let Some(setting) = setting {
        change_struct(req.display_name, &mut setting.display_name);
        change_struct(req.one_liner, &mut setting.one_liner);
        change_struct(req.status, &mut setting.status);
        change_struct(req.avatar_url, &mut setting.avatar_url);

        change_struct_no_option(req.approximate_location, &mut setting.approximate_location);
        change_struct(req.interests, &mut setting.interests);
        change_struct_no_option(req.radius_km, &mut setting.radius_km);
        change_struct(req.tags, &mut setting.tags);
        change_struct(req.live_until, &mut setting.live_until);
        change_struct_no_option(req.onboarding_completed, &mut setting.onboarding_completed);

        let now = chrono::Utc::now().timestamp();

        if setting.live_until.is_some_and(|expiry| expiry as i64 > now) {
            setting.is_live = true;
            setting.last_seen_at = Some(now);
        } else {
            setting.is_live = false;
            setting.last_seen_at = None;
            setting.live_until = None;
        }

        Ok(Json(setting.to_owned()))
    }else{
        Err((StatusCode::BAD_REQUEST, "Email does not exist".to_string()))
    }
}



//Send a SSE ping to online users when you come online
fn ping_live_user(){

}

fn stop_live_check(){}
pub async fn post_location(Extension(AppState): Extension<AppState>, CurrentUser{
    email
}: CurrentUser, Json(req): Json<Location>)-> StatusCode{
    let mut location = AppState.locations.lock().await;
    location.insert(email, req.clone());
    dbg!(location);
    StatusCode::NO_CONTENT
}


fn distance_km(
    lat1: f64,
    lon1: f64,
    lat2: f64,
    lon2: f64,
) -> f64 {
    let earth_radius_km = 6371.0;

    let lat1 = lat1.to_radians();
    let lat2 = lat2.to_radians();

    let delta_lat = lat2 - lat1;
    let delta_lon = (lon2 - lon1).to_radians();

    let a = (delta_lat / 2.0).sin().powi(2)
        + lat1.cos()
        * lat2.cos()
        * (delta_lon / 2.0).sin().powi(2);

    let c = 2.0 * a.sqrt().atan2((1.0 - a).sqrt());

    earth_radius_km * c
}

#[derive(Serialize, Deserialize, Debug)]
pub struct UserCard {
    pub username: Option<String>,
    pub distance: Option<usize>,
    pub interests: Option<Vec<String>>,
    pub avatar_url: Option<String>,
    pub one_liner: Option<String>,
    pub live_until: Option<usize>,
    pub is_live: Option<bool>,
}

pub async fn get_location_nearby(Extension(AppState): Extension<AppState>, CurrentUser{email}: CurrentUser) -> Result<Json<Vec<UserCard>>, (StatusCode, String)> {
    let location = AppState.locations.lock().await;
    let my_location = location.get(&email);
    let setting = AppState.settings.lock().await;
    let my_setting = setting.get(email.as_str());
    if let (Some(my_location_exists), Some(my_settings_exists)) = (my_location, my_setting) {
        let inter_location: Vec<UserCard> = location.iter().filter_map(|saved_location|{
            let value = distance_km(my_location_exists.latitude, my_location_exists.longitude, saved_location.1.latitude, saved_location.1.longitude);
            if my_settings_exists.radius_km as f64 >= value {
                let other_user_settings = setting.get(saved_location.0.as_str());
                if let Some(other_user_setting) = other_user_settings {
                    let now = chrono::Utc::now().timestamp();
                    if other_user_setting.live_until.is_some_and(|expiry| expiry as i64 > now) {
                        Some(UserCard{
                            username: other_user_setting.display_name.clone(),
                            distance: Some(value as usize),
                            interests: other_user_setting.interests.clone(),
                            avatar_url: other_user_setting.avatar_url.clone(),
                            one_liner: other_user_setting.one_liner.clone(),
                            live_until: other_user_setting.live_until,
                            is_live: Some(other_user_setting.is_live),
                        })
                    }else{
                        None
                    }
                }else {
                    None
                }
            }else{
                None
            }
        }).collect();
        Ok(Json(inter_location))
    }else {
        Err((StatusCode::BAD_REQUEST, "Email does not exist".to_string()))
    }
}

fn change_struct<T>(value: Option<T>, struct_key: &mut Option<T>){
    if let Some(value) = value {
        *struct_key = Some(value);
    };
}
fn change_struct_no_option<T>(value: Option<T>, struct_key: &mut T){
    if let Some(value) = value {
        *struct_key = value;
    };
}