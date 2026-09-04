import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { NavSidebar } from "@/components/NavSidebar";
import { DemoModeBanner } from "@/components/DemoModeBanner";
import { useWindowOpacity } from "@/services/runtime/useWindowOpacity";
import { DashboardPage } from "@/pages/DashboardPage";
import { SessionsPage } from "@/pages/SessionsPage";
import { NewSessionPage } from "@/pages/NewSessionPage";
import { SessionDetailPage } from "@/pages/SessionDetailPage";
import { InterviewLivePage } from "@/pages/InterviewLivePage";
import { DocumentsPage } from "@/pages/DocumentsPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { OnboardingPage } from "@/pages/OnboardingPage";
import { OverlayWindowPage } from "@/pages/OverlayWindowPage";
import { useSettingsStore } from "@/stores/settingsStore";
import { useSessionStore } from "@/stores/sessionStore";

export default function App() {
  const location = useLocation();
  const hasCompletedOnboarding = useSettingsStore((s) => s.hasCompletedOnboarding);
  const hydrate = useSessionStore((s) => s.hydrate);
  const isHydrated = useSessionStore((s) => s.isHydrated);

  // Session history lives on disk (SQLite in the desktop build), so it has to
  // be read back before the first render that shows it.
  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // Runs above every early return below, so the window keeps the translucency
  // the user chose on the onboarding and loading screens too.
  useWindowOpacity();

  // The Tauri "overlay" window loads this same SPA at #/overlay — it must
  // never be gated by onboarding or wrapped in the main app shell.
  if (location.pathname === "/overlay") {
    return <OverlayWindowPage />;
  }

  if (!hasCompletedOnboarding) {
    return <OnboardingPage />;
  }

  if (!isHydrated) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-ink-muted">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <DemoModeBanner />
      <div className="flex min-h-0 flex-1">
        <NavSidebar />
        <main className="min-w-0 flex-1 overflow-y-auto p-8">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/sessions" element={<SessionsPage />} />
            <Route path="/sessions/new" element={<NewSessionPage />} />
            <Route path="/sessions/:sessionId" element={<SessionDetailPage />} />
            <Route path="/sessions/:sessionId/live" element={<InterviewLivePage />} />
            <Route path="/documents" element={<DocumentsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
