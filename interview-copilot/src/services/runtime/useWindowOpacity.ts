import { useEffect } from "react";
import { isTauriRuntime } from "@/services/persistence";
import { useSettingsStore } from "@/stores/settingsStore";

/**
 * Applies the stored window translucency to the real OS window.
 *
 * The alpha lives on the native window (a layered-window attribute set by the
 * Rust side), not in CSS: it has to make the frame and title bar see-through
 * too, so the screen behind stays readable during a call. Outside Tauri there
 * is no OS window to fade, so this does nothing and the browser dev server is
 * unaffected.
 */
export function useWindowOpacity(): void {
  const windowOpacity = useSettingsStore((s) => s.windowOpacity);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    let cancelled = false;
    void import("@tauri-apps/api/core").then(({ invoke }) => {
      if (cancelled) return;
      // A failure here must not take the app down with it — a window that is
      // merely opaque is still perfectly usable.
      void invoke("set_window_opacity", { opacity: windowOpacity }).catch(() => {});
    });
    return () => {
      cancelled = true;
    };
  }, [windowOpacity]);
}
