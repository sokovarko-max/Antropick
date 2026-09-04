import { z } from "zod";
import { isTauriRuntime } from "@/services/persistence";

const screenshotSchema = z.object({
  png_base64: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  source: z.string(),
});

export interface Screenshot {
  base64: string;
  width: number;
  height: number;
  /** Window title or monitor name the image came from. */
  source: string;
}

export class ScreenshotUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScreenshotUnavailableError";
  }
}

/**
 * Captures the focused window (or primary monitor) via the Rust
 * `capture_screenshot` command. The image is returned in memory only —
 * persisting it is a separate, privacy-gated decision (docs/security.md).
 */
export async function captureScreenshot(): Promise<Screenshot> {
  if (!isTauriRuntime()) {
    throw new ScreenshotUnavailableError(
      "Screen capture needs the desktop app — it is not available in the browser dev server.",
    );
  }

  const { invoke } = await import("@tauri-apps/api/core");
  // Responses crossing the IPC boundary are validated, not trusted.
  const parsed = screenshotSchema.parse(await invoke("capture_screenshot"));

  return {
    base64: parsed.png_base64,
    width: parsed.width,
    height: parsed.height,
    source: parsed.source,
  };
}
