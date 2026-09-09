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

/// Titles belonging to this app. Capturing one of these is never useful: the
/// hotkey is usually pressed while the copilot itself has focus, and the model
/// then dutifully describes the copilot's own UI instead of the interview.
fn is_own_window(title: &str) -> bool {
    let title = title.trim();
    title == "Interview Copilot" || title == "Interview Copilot Overlay"
}

fn focused_window() -> Option<Window> {
    let windows = Window::all().ok()?;
    windows.into_iter().find(|window| {
        if !window.is_focused().unwrap_or(false) || window.is_minimized().unwrap_or(false) {
            return false;
        }
        !is_own_window(&window.title().unwrap_or_default())
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
            // Windows hands back synthesised names like "Unknown Monitor
            // 65537" for displays with no EDID name. Showing that as "what I
            // captured" tells the user nothing and reads like a failure, so
            // anything that is not a real display name becomes plain "Screen".
            let label = match monitor.friendly_name() {
                Ok(name) if !name.trim().is_empty() && !name.starts_with("Unknown Monitor") => name,
                _ => "Screen".to_string(),
            };
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

#[cfg(test)]
mod tests {
    use super::is_own_window;

    #[test]
    fn recognises_this_app_so_it_never_screenshots_itself() {
        // Ctrl+B is pressed while the copilot has focus, which is exactly when
        // this matters: without the check the vision model was handed a
        // picture of Interview Copilot and described its own sidebar back to
        // the candidate.
        assert!(is_own_window("Interview Copilot"));
        assert!(is_own_window("Interview Copilot Overlay"));
        assert!(is_own_window("  Interview Copilot  "));
    }

    #[test]
    fn leaves_the_windows_worth_capturing_alone() {
        for title in [
            "Zoom Meeting",
            "Microsoft Teams",
            "HackerRank - Google Chrome",
            "Interview Copilot — design doc.docx",
        ] {
            assert!(!is_own_window(title), "{title} should still be capturable");
        }
    }
}
