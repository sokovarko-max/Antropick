import { useAppServices } from "@/services/runtime/useAppServices";
import { useTranslation } from "@/i18n/useTranslation";

export function DemoModeBanner() {
  const { isDemoMode } = useAppServices();
  const { t } = useTranslation();
  if (!isDemoMode) return null;

  return (
    <div className="border-b border-state-thinking/30 bg-state-thinking/10 px-4 py-2 text-center text-xs text-state-thinking">
      {t("demoMode.banner")}
    </div>
  );
}
