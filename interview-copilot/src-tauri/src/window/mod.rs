//! Overlay window management. The overlay is a second window declared in
//! `tauri.conf.json` (label "overlay": frameless, transparent, always-on-top,
//! hidden by default). This module only toggles visibility/position —
//! the overlay's IDLE/LISTENING/THINKING/ANSWERING/ERROR state machine
//! lives in the frontend (Zustand store), driven by events.

use tauri::{AppHandle, Manager, WebviewWindow};

pub fn overlay_window(app: &AppHandle) -> Option<WebviewWindow> {
    app.get_webview_window("overlay")
}

pub fn main_window(app: &AppHandle) -> Option<WebviewWindow> {
    app.get_webview_window("main")
}

/// Brings the main window back from the tray.
///
/// `show` alone is not enough: a window hidden while minimized comes back
/// still minimized, so it reappears on the taskbar and never on screen —
/// which is what made the app look unrecoverable once it was in the tray.
pub fn restore_main_window(app: &AppHandle) -> tauri::Result<()> {
    if let Some(window) = main_window(app) {
        window.unminimize()?;
        window.show()?;
        window.set_focus()?;
    }
    Ok(())
}

pub fn show_overlay(app: &AppHandle) -> tauri::Result<()> {
    if let Some(window) = overlay_window(app) {
        window.show()?;
        window.set_focus()?;
    }
    Ok(())
}

pub fn hide_overlay(app: &AppHandle) -> tauri::Result<()> {
    if let Some(window) = overlay_window(app) {
        window.hide()?;
    }
    Ok(())
}
