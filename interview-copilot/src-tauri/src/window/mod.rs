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

/// Makes the whole main window translucent, frame included, so the screen
/// behind it stays readable during a call.
///
/// This is a layered-window attribute rather than a CSS or WebView setting:
/// the alpha has to apply to the native frame and title bar as well, which
/// nothing inside the page can reach. `opacity` is a fraction; it is clamped
/// so the window can never be made invisible and therefore impossible to find
/// and fix.
/// The error is a `String` rather than `tauri::Error` on purpose: the Win32
/// call returns `windows::core::Error`, which `tauri::Error` has no `From`
/// impl for, and inventing a conversion for one call site would be more code
/// than the message is worth.
#[cfg(target_os = "windows")]
pub fn set_window_opacity(app: &AppHandle, opacity: f64) -> Result<(), String> {
    use windows::Win32::Foundation::{COLORREF, HWND};
    use windows::Win32::UI::WindowsAndMessaging::{
        GetWindowLongPtrW, SetLayeredWindowAttributes, SetWindowLongPtrW, GWL_EXSTYLE, LWA_ALPHA,
        WS_EX_LAYERED,
    };

    let Some(window) = main_window(app) else {
        return Ok(());
    };
    let handle = window.hwnd().map_err(|e| e.to_string())?;
    let hwnd = HWND(handle.0 as *mut std::ffi::c_void);
    let alpha = (opacity.clamp(0.3, 1.0) * 255.0).round() as u8;

    // SAFETY: `hwnd` comes from Tauri's live window handle, and both calls are
    // plain attribute sets on it with no memory handed across the boundary.
    unsafe {
        let ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
        SetWindowLongPtrW(hwnd, GWL_EXSTYLE, ex_style | WS_EX_LAYERED.0 as isize);
        SetLayeredWindowAttributes(hwnd, COLORREF(0), alpha, LWA_ALPHA).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// No-op away from Windows: the other platforms this compiles on are
/// development hosts, and failing here would break `cargo test` on Linux.
#[cfg(not(target_os = "windows"))]
pub fn set_window_opacity(_app: &AppHandle, _opacity: f64) -> Result<(), String> {
    Ok(())
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
