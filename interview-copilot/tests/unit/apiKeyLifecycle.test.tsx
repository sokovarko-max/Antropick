import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();
const secureStoreGet = vi.fn(async (key: string) => store.get(key) ?? null);

vi.mock("@/services/security/secureStore", async () => {
  const actual = await vi.importActual<typeof import("@/services/security/secureStore")>(
    "@/services/security/secureStore",
  );
  return {
    ...actual,
    secureStoreGet: (key: string) => secureStoreGet(key),
    secureStoreSet: async (key: string, value: string) => void store.set(key, value),
    secureStoreDelete: async (key: string) => void store.delete(key),
    secureStoreIsPersistent: async () => true,
  };
});

const { AppServicesProvider } = await import("@/services/runtime/AppServicesContext");
const { useAppServices } = await import("@/services/runtime/useAppServices");
const { useSettingsStore } = await import("@/stores/settingsStore");
const { PROVIDERS } = await import("@/config/models");

function Probe() {
  const { isDemoMode, demoModeReason, providerId } = useAppServices();
  return (
    <div>
      <span data-testid="demo">{String(isDemoMode)}</span>
      <span data-testid="reason">{demoModeReason ?? "none"}</span>
      <span data-testid="provider">{providerId}</span>
    </div>
  );
}

function renderApp() {
  return render(
    <AppServicesProvider>
      <Probe />
    </AppServicesProvider>,
  );
}

beforeEach(() => {
  store.clear();
  secureStoreGet.mockClear();
  useSettingsStore.setState({
    demoMode: false,
    aiProvider: "groq",
    apiKeyPresent: { anthropic: false, groq: false },
  });
});

describe("picking up a stored API key", () => {
  it("uses a key that is in secure storage even when the saved flag says there is none", async () => {
    // The reported "the app never leaves demo mode": the key lookup used to be
    // gated on this persisted boolean, so any way it went stale — a settings
    // file restored without it, a store that had lost the key, a persist
    // migration — hid a perfectly good key and left no way out from the UI.
    store.set(PROVIDERS.groq.secureStorageKey, "gsk_real_key");
    renderApp();

    await waitFor(() => expect(screen.getByTestId("demo").textContent).toBe("false"));
    expect(screen.getByTestId("reason").textContent).toBe("none");
  });

  it("repairs the stale flag rather than leaving it to go wrong again", async () => {
    store.set(PROVIDERS.groq.secureStorageKey, "gsk_real_key");
    renderApp();

    await waitFor(() =>
      expect(useSettingsStore.getState().apiKeyPresent.groq).toBe(true),
    );
  });

  it("clears the flag when the flag claims a key the store does not have", async () => {
    // The other direction, and the shape of the keyring bug on Windows: the
    // flag survives in settings.json while the credential itself is gone.
    useSettingsStore.setState({ apiKeyPresent: { anthropic: false, groq: true } });
    renderApp();

    await waitFor(() => expect(screen.getByTestId("reason").textContent).toBe("NO_API_KEY"));
    expect(useSettingsStore.getState().apiKeyPresent.groq).toBe(false);
  });

  it("looks in the store belonging to the selected provider", async () => {
    store.set(PROVIDERS.anthropic.secureStorageKey, "sk-ant-key");
    renderApp();

    // A Groq session must not be started with the Anthropic key.
    await waitFor(() => expect(screen.getByTestId("demo").textContent).toBe("true"));
    expect(secureStoreGet).toHaveBeenCalledWith(PROVIDERS.groq.secureStorageKey);
    expect(secureStoreGet).not.toHaveBeenCalledWith(PROVIDERS.anthropic.secureStorageKey);
  });

  it("falls back to demo answers when the credential store cannot be read", async () => {
    secureStoreGet.mockRejectedValueOnce(new Error("credential store unavailable"));
    renderApp();

    await waitFor(() => expect(screen.getByTestId("demo").textContent).toBe("true"));
  });

  it("keeps serving mock answers while the demo switch is on, key or not", async () => {
    store.set(PROVIDERS.groq.secureStorageKey, "gsk_real_key");
    useSettingsStore.setState({ demoMode: true });
    renderApp();

    await waitFor(() => expect(screen.getByTestId("reason").textContent).toBe("EXPLICIT_SETTING"));
  });
});
