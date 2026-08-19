import { useEffect, useRef } from "react";
import { isTauriRuntime } from "@/services/persistence";

/** Event names emitted by src-tauri/src/hotkeys/mod.rs. */
export const HOTKEY_EVENTS = {
  askAi: "hotkey:ask-ai",
  screenshot: "hotkey:screenshot",
  hide: "hotkey:hide",
  pause: "hotkey:pause",
} as const;

export interface HotkeyHandlers {
  onAskAi?: () => void;
  onScreenshot?: () => void;
  onHide?: () => void;
  onPause?: () => void;
}

/**
 * Subscribes to the global hotkeys registered on the Rust side (Ctrl+Q,
 * Ctrl+B, Ctrl+Shift+H, Ctrl+Shift+P). Outside a Tauri window there are no
 * global hotkeys to listen to, so this is a no-op and the on-screen overlay
 * buttons remain the way to trigger the same actions.
 *
 * Handlers are held in a ref so a re-render with new closures does not tear
 * down and re-register the listeners mid-interview.
 */
export function useDesktopHotkeys(handlers: HotkeyHandlers): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!isTauriRuntime()) return;

    let disposed = false;
    const unlisteners: Array<() => void> = [];

    void (async () => {
      const { listen } = await import("@tauri-apps/api/event");
      const bindings: Array<[string, () => void]> = [
        [HOTKEY_EVENTS.askAi, () => handlersRef.current.onAskAi?.()],
        [HOTKEY_EVENTS.screenshot, () => handlersRef.current.onScreenshot?.()],
        [HOTKEY_EVENTS.hide, () => handlersRef.current.onHide?.()],
        [HOTKEY_EVENTS.pause, () => handlersRef.current.onPause?.()],
      ];

      for (const [eventName, handler] of bindings) {
        const unlisten = await listen(eventName, () => handler());
        // The effect may have been cleaned up while we were awaiting.
        if (disposed) unlisten();
        else unlisteners.push(unlisten);
      }
    })();

    return () => {
      disposed = true;
      for (const unlisten of unlisteners) unlisten();
    };
  }, []);
}
