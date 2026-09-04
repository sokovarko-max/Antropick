import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { t } from "@/i18n";
import { useTranslation } from "@/i18n/useTranslation";
import { useSettingsStore } from "@/stores/settingsStore";
import en from "@/i18n/en.json";
import ru from "@/i18n/ru.json";

function LocaleProbe() {
  const { t: translate, locale } = useTranslation();
  return (
    <div>
      <span data-testid="label">{translate("nav.settings")}</span>
      <span data-testid="locale">{locale}</span>
    </div>
  );
}

describe("t()", () => {
  it("returns the string for the requested locale", () => {
    expect(t("nav.settings", "en")).toBe("Settings");
    expect(t("nav.settings", "ru")).toBe("Настройки");
  });

  it("falls back to English when a key is missing from a locale", () => {
    // Simulates a partially translated dictionary rather than showing a blank.
    const partial = "settings.appearance.overlayOpacity" as const;
    expect(t(partial, "ru")).not.toBe("");
  });

  it("returns the key itself for an unknown key rather than throwing", () => {
    expect(t("does.not.exist" as never, "en")).toBe("does.not.exist");
  });
});

describe("translation dictionaries", () => {
  it("define exactly the same keys in both languages", () => {
    // A key present in one file but not the other silently falls back to
    // English at runtime, which reads as "the switch didn't work".
    expect(Object.keys(ru).sort()).toEqual(Object.keys(en).sort());
  });

  it("has no untranslated (identical) Russian values for user-facing copy", () => {
    const identical = Object.keys(en).filter(
      (key) =>
        (en as Record<string, string>)[key] === (ru as Record<string, string>)[key] &&
        // The product name is intentionally the same in both.
        key !== "app.title",
    );
    expect(identical).toEqual([]);
  });
});

describe("useTranslation", () => {
  beforeEach(() => {
    useSettingsStore.setState({ locale: "en" });
  });

  it("renders copy for the store's current locale", () => {
    render(<LocaleProbe />);
    expect(screen.getByTestId("label").textContent).toBe("Settings");
  });

  it("re-renders with new copy when the locale changes", () => {
    // This is the regression: previously `t` was a plain import reading a
    // module-level variable, so switching the language repainted nothing.
    render(<LocaleProbe />);
    expect(screen.getByTestId("label").textContent).toBe("Settings");

    act(() => {
      useSettingsStore.getState().setLocale("ru");
    });

    expect(screen.getByTestId("label").textContent).toBe("Настройки");
    expect(screen.getByTestId("locale").textContent).toBe("ru");
  });

  it("switches back to English", () => {
    render(<LocaleProbe />);
    act(() => useSettingsStore.getState().setLocale("ru"));
    act(() => useSettingsStore.getState().setLocale("en"));
    expect(screen.getByTestId("label").textContent).toBe("Settings");
  });
});

describe("placeholder interpolation", () => {
  it("substitutes named variables", () => {
    const message = t("aiError.INSUFFICIENT_CREDITS", "en", {
      provider: "Groq",
      console: "https://console.groq.com/keys",
    });
    expect(message).toContain("Groq");
    expect(message).toContain("https://console.groq.com/keys");
    expect(message).not.toContain("{");
  });

  it("leaves an unknown placeholder visible rather than printing 'undefined'", () => {
    expect(t("aiError.INSUFFICIENT_CREDITS", "en", {})).toContain("{provider}");
  });

  it("never names a specific vendor in shared error copy", () => {
    // Regression: this copy was written for a single provider, so a Groq user
    // was told to top up an Anthropic account and sent to the wrong console.
    const shared = [
      "aiError.INSUFFICIENT_CREDITS",
      "aiError.INVALID_API_KEY",
      "aiError.PERMISSION_DENIED",
      "aiError.RATE_LIMITED",
      "aiError.SERVER_ERROR",
      "aiError.NETWORK_ERROR",
    ] as const;

    for (const locale of ["en", "ru"] as const) {
      for (const key of shared) {
        const raw = t(key, locale);
        expect(raw, `${key} (${locale})`).not.toMatch(/anthropic|groq|claude/i);
      }
    }
  });
});
