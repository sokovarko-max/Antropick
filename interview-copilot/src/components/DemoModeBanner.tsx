import { Link } from "react-router-dom";
import { useAppServices } from "@/services/runtime/useAppServices";
import { useTranslation } from "@/i18n/useTranslation";

/**
 * States *why* mock answers are being served and links to the exact screen
 * that turns them off. The previous copy ("no API key required") described
 * demo mode as a feature, which left a user who had already added a working
 * key with nothing to click and no idea the switch in Settings was overriding
 * it.
 */
export function DemoModeBanner() {
  const { isDemoMode, demoModeReason } = useAppServices();
  const { t } = useTranslation();
  if (!isDemoMode) return null;

  return (
    <div className="border-b border-state-thinking/30 bg-state-thinking/10 px-4 py-2 text-center text-xs text-state-thinking">
      {demoModeReason === "EXPLICIT_SETTING"
        ? t("demoMode.reason.explicitSetting")
        : t("demoMode.reason.noApiKey")}{" "}
      <Link to="/settings" className="underline underline-offset-2">
        {t("demoMode.openSettings")}
      </Link>
    </div>
  );
}
