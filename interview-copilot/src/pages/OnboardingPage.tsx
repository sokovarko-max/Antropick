import { useState } from "react";
import { useSettingsStore } from "@/stores/settingsStore";

const STEPS = [
  "Welcome",
  "Privacy",
  "AI Provider",
  "Microphone & System Audio",
  "Hotkeys",
  "Ready",
] as const;

export function OnboardingPage() {
  const [step, setStep] = useState(0);
  const completeOnboarding = useSettingsStore((s) => s.completeOnboarding);
  const setDemoMode = useSettingsStore((s) => s.setDemoMode);

  const isLast = step === STEPS.length - 1;

  return (
    <div className="flex h-screen items-center justify-center bg-surface">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-surface-border bg-surface-raised p-8">
        <div className="flex gap-1">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-accent" : "bg-surface-border"}`} />
          ))}
        </div>

        <h1 className="text-xl font-semibold text-ink">{STEPS[step]}</h1>

        {step === 0 && (
          <p className="text-sm text-ink-muted">
            Interview Copilot listens to your interview, detects questions in real time, and shows
            concise AI-generated suggestions in a floating overlay.
          </p>
        )}
        {step === 1 && (
          <p className="text-sm text-ink-muted">
            By default: transcripts are saved to your session history, screenshots and audio are NOT
            saved, and cloud processing is required for realtime AI. Change any of this later in
            Settings → Privacy.
          </p>
        )}
        {step === 2 && (
          <p className="text-sm text-ink-muted">
            Add your Anthropic API key in Settings → AI after finishing setup, or continue in Demo
            Mode with no key (mock transcript + mock AI responses).
          </p>
        )}
        {step === 3 && (
          <p className="text-sm text-ink-muted">
            The desktop build requests microphone and system-audio (loopback) permissions on first
            launch. Not applicable in this browser preview.
          </p>
        )}
        {step === 4 && (
          <p className="text-sm text-ink-muted">
            Default hotkeys: Ctrl+Q Ask AI · Ctrl+B Screenshot · Ctrl+Shift+H Hide · Ctrl+Shift+P Pause.
            Customizable in Settings → Hotkeys.
          </p>
        )}
        {step === 5 && (
          <p className="text-sm text-ink-muted">You're all set. Demo Mode is on by default — turn it off in Settings once you've added a real API key.</p>
        )}

        <div className="flex justify-between pt-2">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="rounded-lg px-4 py-2 text-sm text-ink-muted disabled:opacity-0"
          >
            Back
          </button>
          <button
            onClick={() => {
              if (isLast) {
                setDemoMode(true);
                completeOnboarding();
              } else {
                setStep((s) => s + 1);
              }
            }}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
          >
            {isLast ? "Get started" : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
