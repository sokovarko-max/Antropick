import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useSessionStore } from "@/stores/sessionStore";
import type { InterviewFramework, ResponseMode, SessionMode } from "@/types";
import { DocumentUploader } from "@/features/documents/DocumentUploader";
import { useTranslation } from "@/i18n/useTranslation";

const FRAMEWORKS: InterviewFramework[] = [
  "NONE",
  "STAR",
  "PREP",
  "CAR",
  "TECHNICAL",
  "SYSTEM_DESIGN",
  "BEHAVIORAL",
  "SALES",
  "PRODUCT_MANAGEMENT",
];

export function NewSessionPage() {
  const navigate = useNavigate();
  const createSession = useSessionStore((s) => s.createSession);
  const { t } = useTranslation();

  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [userInstructions, setUserInstructions] = useState("");
  const [responseLanguage, setResponseLanguage] = useState<"en" | "ru">("en");
  const [responseMode, setResponseMode] = useState<ResponseMode>("SHORT");
  const [framework, setFramework] = useState<InterviewFramework>("NONE");
  const [mode, setMode] = useState<SessionMode>("AUTO");

  function handleStart() {
    const session = createSession({
      title: role ? `${role}${company ? ` — ${company}` : ""}` : "Interview",
      role,
      company,
      mode,
      responseLanguage,
      responseMode,
      framework,
      userInstructions,
    });
    navigate(`/sessions/${session.id}/live`);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold text-ink">{t("newSession.title")}</h1>

      <Field label={t("newSession.role")}>
        <input
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="input"
          placeholder="Senior Backend Engineer"
        />
      </Field>

      <Field label={t("newSession.company")}>
        <input
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          className="input"
          placeholder="Acme Corp"
        />
      </Field>

      <Field label={t("newSession.jobDescription")}>
        <DocumentUploader docType="JOB_DESCRIPTION" />
      </Field>

      <Field label={t("newSession.resume")}>
        <DocumentUploader docType="RESUME" />
      </Field>

      <Field label={t("newSession.additionalDocuments")}>
        <DocumentUploader docType="NOTES" />
      </Field>

      <Field label={t("newSession.aiInstructions")}>
        <textarea
          value={userInstructions}
          onChange={(e) => setUserInstructions(e.target.value)}
          className="input h-24 resize-none"
          placeholder="Focus on system design, keep answers direct..."
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label={t("newSession.responseLanguage")}>
          <select
            value={responseLanguage}
            onChange={(e) => setResponseLanguage(e.target.value as "en" | "ru")}
            className="input"
          >
            <option value="en">English</option>
            <option value="ru">Русский</option>
          </select>
        </Field>

        <Field label={t("newSession.mode")}>
          <select value={mode} onChange={(e) => setMode(e.target.value as SessionMode)} className="input">
            <option value="AUTO">Auto</option>
            <option value="MANUAL">Manual</option>
          </select>
        </Field>

        <Field label="Response length">
          <select
            value={responseMode}
            onChange={(e) => setResponseMode(e.target.value as ResponseMode)}
            className="input"
          >
            <option value="SHORT">Short</option>
            <option value="NORMAL">Normal</option>
            <option value="DETAILED">Detailed</option>
          </select>
        </Field>

        <Field label="Framework">
          <select
            value={framework}
            onChange={(e) => setFramework(e.target.value as InterviewFramework)}
            className="input"
          >
            {FRAMEWORKS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <button
        onClick={handleStart}
        className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent/90"
      >
        {t("newSession.start")}
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-ink-muted">{label}</span>
      {children}
    </label>
  );
}
