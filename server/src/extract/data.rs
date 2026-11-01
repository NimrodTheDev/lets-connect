use axum::extract::{FromRequest, Request};
use axum::http::StatusCode;
use axum::Json;
use serde::de::DeserializeOwned;
use validator::Validate;

pub struct ApiJson<T: DeserializeOwned >(pub T);
impl<S: Send + Sync, T: DeserializeOwned + Validate> FromRequest<S> for ApiJson<T> {
    type Rejection = (StatusCode, String);
    async fn from_request(req: Request, state: &S) -> Result<Self, Self::Rejection> {
        let Json(value) = Json::<T>::from_request(req, state).await.map_err(|e| (e.status(), e.body_text()))?;
        value.validate().map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;
        Ok(Self(value))
    }
}


pub struct ApiQuery<T: DeserializeOwned + Validate>(pub T);



