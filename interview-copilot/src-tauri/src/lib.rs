//! Interview Copilot desktop backend.
//!
//! NOTE: this crate has not been compiled in the environment that produced
//! it — no webkit2gtk dev headers are available there and there is no
//! Windows host. It is written against the documented Tauri 2 / cpal /
//! keyring / rusqlite APIs but must be validated on a real Windows dev
//! machine before being trusted. See CLAUDE.md.

pub mod audio;
pub mod capture;
pub mod commands;
pub mod database;
pub mod hotkeys;
pub mod security;
pub mod window;

use tauri::Manager;

pub fn run() {
    tracing_subscriber::fmt::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir().expect("resolve app data dir");
            std::fs::create_dir_all(&app_data_dir).expect("create app data dir");

            let db = database::Database::open(&app_data_dir.join("interview-copilot.db"))
                .expect("open database");
            db.migrate().expect("run migrations");
            app.manage(db);

            hotkeys::register_default_hotkeys(app.handle())?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::secure_store_set,
            commands::secure_store_get,
            commands::secure_store_delete,
            commands::capture_screenshot,
            commands::list_audio_devices,
            commands::start_audio_capture,
            commands::stop_audio_capture,
            commands::db_execute,
            commands::db_query,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Interview Copilot");
}
