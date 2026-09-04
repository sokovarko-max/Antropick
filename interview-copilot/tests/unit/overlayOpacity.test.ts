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

describe("window translucency", () => {
  it("clamps to a floor so the window can never be faded away entirely", () => {
    // A window at 0% cannot be found again to undo the setting — the same
    // reason the overlay slider has a floor.
    useSettingsStore.getState().setWindowOpacity(0);
    expect(useSettingsStore.getState().windowOpacity).toBe(0.3);

    useSettingsStore.getState().setWindowOpacity(-5);
    expect(useSettingsStore.getState().windowOpacity).toBe(0.3);
  });

  it("never exceeds fully opaque", () => {
    useSettingsStore.getState().setWindowOpacity(2);
    expect(useSettingsStore.getState().windowOpacity).toBe(1);
  });

  it("keeps a value inside the range as chosen", () => {
    useSettingsStore.getState().setWindowOpacity(0.65);
    expect(useSettingsStore.getState().windowOpacity).toBeCloseTo(0.65, 5);
  });

  it("is independent of the overlay panel's own opacity", () => {
    // Two separate surfaces: fading the app window must not fade the overlay
    // the candidate is reading from.
    useSettingsStore.getState().setWindowOpacity(0.4);
    useSettingsStore.getState().setOverlayOpacity(1);
    expect(useSettingsStore.getState().windowOpacity).toBe(0.4);
    expect(useSettingsStore.getState().overlayOpacity).toBe(1);
  });
});
