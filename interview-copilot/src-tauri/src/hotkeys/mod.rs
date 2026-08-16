//! Global hotkeys (Ctrl+Q Ask AI, Ctrl+B Screenshot, Ctrl+Shift+H Hide,
//! Ctrl+Shift+P Pause), configurable — bindings are read from the `hotkeys`
//! DB table via the `settings` Tauri command surface (frontend-driven), this
//! module only registers/re-registers combos and emits window events.

use tauri::{AppHandle, Emitter};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

pub const EVENT_ASK_AI: &str = "hotkey:ask-ai";
pub const EVENT_SCREENSHOT: &str = "hotkey:screenshot";
pub const EVENT_HIDE: &str = "hotkey:hide";
pub const EVENT_PAUSE: &str = "hotkey:pause";

pub fn register_default_hotkeys(app: &AppHandle) -> tauri::Result<()> {
    let bindings: [(Shortcut, &'static str); 4] = [
        (
            Shortcut::new(Some(Modifiers::CONTROL), Code::KeyQ),
            EVENT_ASK_AI,
        ),
        (
            Shortcut::new(Some(Modifiers::CONTROL), Code::KeyB),
            EVENT_SCREENSHOT,
        ),
        (
            Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::KeyH),
            EVENT_HIDE,
        ),
        (
            Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::KeyP),
            EVENT_PAUSE,
        ),
    ];

    for (shortcut, event_name) in bindings {
        let app_handle = app.clone();
        app.global_shortcut()
            .on_shortcut(shortcut, move |_app, _shortcut, event| {
                if event.state() == ShortcutState::Pressed {
                    let _ = app_handle.emit(event_name, ());
                }
            })?;
    }

    Ok(())
}
