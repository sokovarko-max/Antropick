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

use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Manager, WindowEvent};

/// Builds the tray icon and its menu.
///
/// `tauri.conf.json` used to declare `trayIcon`, which puts an icon in the
/// notification area with no handlers attached: clicking it did nothing, so
/// once the window was hidden the app could not be brought back at all. The
/// icon is built here instead, where it can carry behaviour.
fn setup_tray(app: &tauri::AppHandle) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Open Interview Copilot", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &quit])?;

    let mut builder = TrayIconBuilder::with_id("main")
        .tooltip("Interview Copilot")
        .menu(&menu)
        // Left click restores the window; the menu stays on right click, which
        // is what a Windows tray icon is expected to do.
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                let _ = window::restore_main_window(app);
            }
            // The only way out of the app once closing hides to the tray, so
            // it must not depend on a window still existing.
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let _ = window::restore_main_window(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.build(app)?;
    Ok(())
}

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
            setup_tray(app.handle())?;

            Ok(())
        })
        // Closing the main window hides it to the tray instead of ending the
        // process, so a session keeps running and the overlay stays alive.
        // Quit is on the tray menu. The overlay is left alone: its own close
        // path already just hides it.
        .on_window_event(|window, event| {
            if window.label() != "main" {
                return;
            }
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::secure_store_set,
            commands::secure_store_get,
            commands::secure_store_delete,
            commands::secure_store_is_persistent,
            commands::set_window_opacity,
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
