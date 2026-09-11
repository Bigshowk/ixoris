"use client";

import { useI18n } from "../lib/i18n-context";

export function PlaceholderPage({ titleKey }: { titleKey: string }) {
  const { t } = useI18n();
  return (
    <div className="space-y-2">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-white">{t(titleKey)}</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400">{t("common.comingSoon")}</p>
    </div>
  );
}
