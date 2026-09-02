import { NavLink } from "react-router-dom";
import { useTranslation } from "@/i18n/useTranslation";
import type { TranslationKey } from "@/i18n";

// Only the route shape is static. The labels are resolved inside the
// component — computing them at module scope froze them at import time, so
// they survived even a full re-render on a language change.
const LINKS: { to: string; labelKey: TranslationKey; end: boolean }[] = [
  { to: "/", labelKey: "nav.dashboard", end: true },
  { to: "/sessions", labelKey: "nav.sessions", end: false },
  { to: "/documents", labelKey: "nav.documents", end: false },
  { to: "/settings", labelKey: "nav.settings", end: false },
];

export function NavSidebar() {
  const { t } = useTranslation();

  return (
    <aside className="w-56 shrink-0 border-r border-surface-border bg-surface-raised p-4">
      <div className="mb-8 px-2 text-lg font-semibold tracking-tight text-ink">{t("app.title")}</div>
      <nav className="flex flex-col gap-1">
        {LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) =>
              `rounded-lg px-3 py-2 text-sm transition-colors ${
                isActive
                  ? "bg-accent/15 text-accent"
                  : "text-ink-muted hover:bg-surface-overlay hover:text-ink"
              }`
            }
          >
            {t(link.labelKey)}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
