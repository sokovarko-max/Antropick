//! Screenshot / active-window capture, triggered by the Ctrl+B global
//! hotkey. Captures to an in-memory buffer; only written to disk if the
//! caller (frontend, gated by Privacy Settings) explicitly asks to persist
//! it — see docs/security.md.

use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct ScreenshotResult {
    pub png_base64: String,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, thiserror::Error)]
pub enum CaptureError {
    #[error("no active display found")]
    NoDisplay,
    #[error("capture failed: {0}")]
    Failed(String),
}

/// Captures the active window's bitmap. Implemented against the Win32 GDI
/// APIs (BitBlt from the foreground window's device context) on Windows;
/// unverified by compilation in this container — see CLAUDE.md.
#[cfg(windows)]
pub fn capture_active_window() -> Result<ScreenshotResult, CaptureError> {
    // NOTE: full BitBlt/GetForegroundWindow implementation intentionally
    // left as a documented follow-up — see docs/architecture.md §9. The
    // command surface (capture_screenshot) and result shape are final;
    // swapping in a real capture call here does not change any caller.
    Err(CaptureError::Failed(
        "Win32 screenshot capture not implemented in this scaffold — see docs/architecture.md §9"
            .to_string(),
    ))
}

#[cfg(not(windows))]
pub fn capture_active_window() -> Result<ScreenshotResult, CaptureError> {
    Err(CaptureError::Failed(
        "screenshot capture is only implemented for Windows".to_string(),
    ))
}
