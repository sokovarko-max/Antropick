import { NavLink } from "react-router-dom";
import { t } from "@/i18n";

const links = [
  { to: "/", label: t("nav.dashboard"), end: true },
  { to: "/sessions", label: t("nav.sessions"), end: false },
  { to: "/documents", label: t("nav.documents"), end: false },
  { to: "/settings", label: t("nav.settings"), end: false },
];

export function NavSidebar() {
  return (
    <aside className="w-56 shrink-0 border-r border-surface-border bg-surface-raised p-4">
      <div className="mb-8 px-2 text-lg font-semibold tracking-tight text-ink">{t("app.title")}</div>
      <nav className="flex flex-col gap-1">
        {links.map((link) => (
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
            {link.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
