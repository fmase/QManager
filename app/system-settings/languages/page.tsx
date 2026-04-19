"use client";

import { useTranslation } from "react-i18next";
import { LanguagePackCard } from "@/components/i18n/language-pack-card";

export default function LanguagesPage() {
  const { t } = useTranslation("system-settings");
  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("languages.page.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("languages.page.description")}
        </p>
      </div>
      <LanguagePackCard />
    </div>
  );
}
