import { beforeEach, describe, expect, it } from "vitest";
import { useSettingsStore } from "@/stores/settingsStore";

describe("overlay opacity setting", () => {
  beforeEach(() => {
    useSettingsStore.setState({ overlayOpacity: 1 });
  });

  it("defaults to fully opaque, so the panel looks unchanged until asked", () => {
    expect(useSettingsStore.getState().overlayOpacity).toBe(1);
  });

  it("stores a value in range", () => {
    useSettingsStore.getState().setOverlayOpacity(0.6);
    expect(useSettingsStore.getState().overlayOpacity).toBeCloseTo(0.6, 5);
  });

  it("clamps below 0.3 so the panel can never be made invisible", () => {
    // An invisible overlay would also be an unfindable one — the user could
    // not get back to the slider that caused it.
    useSettingsStore.getState().setOverlayOpacity(0);
    expect(useSettingsStore.getState().overlayOpacity).toBe(0.3);

    useSettingsStore.getState().setOverlayOpacity(-5);
    expect(useSettingsStore.getState().overlayOpacity).toBe(0.3);
  });

  it("clamps above 1", () => {
    useSettingsStore.getState().setOverlayOpacity(3);
    expect(useSettingsStore.getState().overlayOpacity).toBe(1);
  });
});
