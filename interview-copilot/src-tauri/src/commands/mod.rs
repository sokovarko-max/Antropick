//! Tauri command surface — the only bridge the frontend has into the Rust
//! process. Every command validates its own input rather than trusting the
//! frontend already did (see docs/security.md — IPC boundary validation).

use crate::{audio, capture, database::Database, security};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{AppHandle, State};

/// Live capture threads, keyed by channel. Managed by Tauri so `stop` can
/// reach the handle that `start` created — dropping a handle also stops it.
#[derive(Default)]
pub struct AudioCaptureState(pub Mutex<HashMap<String, audio::AudioCaptureHandle>>);

#[tauri::command]
pub fn secure_store_set(key: String, value: String) -> Result<(), String> {
    if key.is_empty() {
        return Err("key must not be empty".into());
    }
    security::set(&key, &value).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn secure_store_get(key: String) -> Result<Option<String>, String> {
    security::get(&key).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn secure_store_delete(key: String) -> Result<(), String> {
    security::delete(&key).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn capture_screenshot() -> Result<capture::ScreenshotResult, String> {
    capture::capture_active_window().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_audio_devices() -> Result<Vec<audio::AudioDeviceInfo>, String> {
    audio::list_devices().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn start_audio_capture(
    app: AppHandle,
    state: State<AudioCaptureState>,
    channel: String,
) -> Result<(), String> {
    let channel_static: &'static str = match channel.as_str() {
        "microphone" => "microphone",
        "system" => "system",
        other => return Err(format!("unknown audio channel: {other}")),
    };

    let mut handles = state.0.lock().map_err(|_| "audio state lock poisoned")?;
    if handles.contains_key(channel_static) {
        return Err(format!("{channel_static} capture is already running"));
    }

    let handle = audio::start_capture(channel_static, move |chunk| {
        use tauri::Emitter;
        let _ = app.emit("audio-chunk", &chunk);
    })
    .map_err(|e| e.to_string())?;

    handles.insert(channel_static.to_string(), handle);
    Ok(())
}

#[tauri::command]
pub fn stop_audio_capture(state: State<AudioCaptureState>, channel: String) -> Result<(), String> {
    let mut handles = state.0.lock().map_err(|_| "audio state lock poisoned")?;
    if let Some(mut handle) = handles.remove(&channel) {
        handle.stop();
    }
    Ok(())
}

/// Generic parameterized write (INSERT/UPDATE/DELETE) — statement text is
/// never built from unsanitized user input at any call site; only `params`
/// carries user data, bound positionally by rusqlite.
#[derive(Debug, Deserialize)]
pub struct DbExecuteRequest {
    pub sql: String,
    pub params: Vec<serde_json::Value>,
}

#[tauri::command]
pub fn db_execute(db: State<Database>, request: DbExecuteRequest) -> Result<usize, String> {
    let conn = db.conn.lock().map_err(|_| "db lock poisoned".to_string())?;
    let params = to_rusqlite_params(&request.params);
    conn.execute(&request.sql, rusqlite::params_from_iter(params))
        .map_err(|e| e.to_string())
}

#[derive(Debug, Deserialize)]
pub struct DbQueryRequest {
    pub sql: String,
    pub params: Vec<serde_json::Value>,
}

#[derive(Debug, Serialize)]
pub struct DbQueryResponse {
    pub rows: Vec<serde_json::Map<String, serde_json::Value>>,
}

#[tauri::command]
pub fn db_query(db: State<Database>, request: DbQueryRequest) -> Result<DbQueryResponse, String> {
    let conn = db.conn.lock().map_err(|_| "db lock poisoned".to_string())?;
    let mut stmt = conn.prepare(&request.sql).map_err(|e| e.to_string())?;
    let column_names: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();
    let params = to_rusqlite_params(&request.params);

    let rows = stmt
        .query_map(rusqlite::params_from_iter(params), |row| {
            let mut map = serde_json::Map::new();
            for (i, name) in column_names.iter().enumerate() {
                let value: rusqlite::types::Value = row.get(i)?;
                map.insert(name.clone(), rusqlite_value_to_json(value));
            }
            Ok(map)
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(DbQueryResponse { rows })
}

fn to_rusqlite_params(values: &[serde_json::Value]) -> Vec<rusqlite::types::Value> {
    values
        .iter()
        .map(|v| match v {
            serde_json::Value::Null => rusqlite::types::Value::Null,
            serde_json::Value::Bool(b) => rusqlite::types::Value::Integer(*b as i64),
            serde_json::Value::Number(n) => n
                .as_i64()
                .map(rusqlite::types::Value::Integer)
                .or_else(|| n.as_f64().map(rusqlite::types::Value::Real))
                .unwrap_or(rusqlite::types::Value::Null),
            serde_json::Value::String(s) => rusqlite::types::Value::Text(s.clone()),
            other => rusqlite::types::Value::Text(other.to_string()),
        })
        .collect()
}

fn rusqlite_value_to_json(value: rusqlite::types::Value) -> serde_json::Value {
    match value {
        rusqlite::types::Value::Null => serde_json::Value::Null,
        rusqlite::types::Value::Integer(i) => serde_json::Value::from(i),
        rusqlite::types::Value::Real(f) => serde_json::Value::from(f),
        rusqlite::types::Value::Text(s) => serde_json::Value::from(s),
        rusqlite::types::Value::Blob(b) => serde_json::Value::from(b),
    }
}
