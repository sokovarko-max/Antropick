//! Screenshot capture, triggered by the Ctrl+B global hotkey.
//!
//! Captures to an in-memory PNG and returns it base64-encoded; nothing is
//! written to disk here. Persisting a screenshot is the frontend's decision,
//! gated on Privacy Settings → "Save screenshots" (default OFF) — see
//! docs/security.md.
//!
//! Uses `xcap` rather than hand-rolled Win32 GDI calls: it keeps the platform
//! specifics in a maintained upstream crate, avoids a large block of `unsafe`
//! FFI, and gets macOS/Linux support for free, which is what
//! docs/architecture.md §3 asks for ("don't tie business logic to Win32").

use base64::Engine;
use image::codecs::png::PngEncoder;
use image::{ExtendedColorType, ImageEncoder, RgbaImage};
use serde::Serialize;
use xcap::{Monitor, Window};

#[derive(Debug, Clone, Serialize)]
pub struct ScreenshotResult {
    pub png_base64: String,
    pub width: u32,
    pub height: u32,
    /// Window title or monitor name, shown in the overlay so the user can see
    /// what was actually captured before it goes to the vision model.
    pub source: String,
}

#[derive(Debug, thiserror::Error)]
pub enum CaptureError {
    #[error("no display or window available to capture")]
    NoDisplay,
    #[error("capture failed: {0}")]
    Failed(String),
}

fn focused_window() -> Option<Window> {
    let windows = Window::all().ok()?;
    windows
        .into_iter()
        .find(|window| {
            window.is_focused().unwrap_or(false) && !window.is_minimized().unwrap_or(false)
        })
}

fn primary_monitor() -> Option<Monitor> {
    let monitors = Monitor::all().ok()?;
    monitors
        .iter()
        .find(|monitor| monitor.is_primary().unwrap_or(false))
        .cloned()
        .or_else(|| monitors.into_iter().next())
}

fn encode_png(image: &RgbaImage) -> Result<String, CaptureError> {
    let mut buffer = Vec::new();
    PngEncoder::new(&mut buffer)
        .write_image(
            image.as_raw(),
            image.width(),
            image.height(),
            ExtendedColorType::Rgba8,
        )
        .map_err(|e| CaptureError::Failed(e.to_string()))?;
    Ok(base64::engine::general_purpose::STANDARD.encode(&buffer))
}

/// Captures the focused window, falling back to the primary monitor when no
/// window reports focus — during a call the content the candidate needs to
/// ask about is often in a screen-share window that never takes focus.
pub fn capture_active_window() -> Result<ScreenshotResult, CaptureError> {
    let (image, source) = match focused_window() {
        Some(window) => {
            let label = window.title().unwrap_or_else(|_| "window".to_string());
            let image = window
                .capture_image()
                .map_err(|e| CaptureError::Failed(e.to_string()))?;
            (image, label)
        }
        None => {
            let monitor = primary_monitor().ok_or(CaptureError::NoDisplay)?;
            let label = monitor
                .friendly_name()
                .unwrap_or_else(|_| "screen".to_string());
            let image = monitor
                .capture_image()
                .map_err(|e| CaptureError::Failed(e.to_string()))?;
            (image, label)
        }
    };

    Ok(ScreenshotResult {
        width: image.width(),
        height: image.height(),
        png_base64: encode_png(&image)?,
        source,
    })
}
