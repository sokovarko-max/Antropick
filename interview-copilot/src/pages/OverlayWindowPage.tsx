import { useOverlayStore } from "@/stores/overlayStore";
import { OverlayPanel } from "@/components/OverlayPanel";

/**
 * Rendered in the frameless/transparent/always-on-top "overlay" Tauri
 * window (see src-tauri/tauri.conf.json). In the browser dev server this
 * mirrors whatever the main window's InterviewLivePage last wrote to
 * overlayStore, which is enough to preview the overlay's look without a
 * Tauri build.
 */
export function OverlayWindowPage() {
  const setVisible = useOverlayStore((s) => s.setVisible);

  return (
    <div className="flex h-screen items-center justify-center bg-transparent p-2">
      <OverlayPanel
        onAskAi={() => {}}
        onScreenshot={() => {}}
        onTogglePause={() => useOverlayStore.getState().togglePause()}
        onHide={() => setVisible(false)}
      />
    </div>
  );
}
