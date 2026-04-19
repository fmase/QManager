"use client";

import * as React from "react";
import { useTranslation } from "react-i18next";
import { Languages } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AVAILABLE_LANGUAGES } from "@/lib/i18n/available-languages";

export function LanguageSwitcher({ className }: { className?: string }) {
  const { t, i18n } = useTranslation("common");

  const handleChange = (value: string) => {
    i18n.changeLanguage(value);
  };

  return (
    <div
      className={className}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <Select value={i18n.language} onValueChange={handleChange}>
        <SelectTrigger
          aria-label={t("language.switch_aria")}
          className="h-8 w-full justify-start gap-2 border-0 bg-transparent px-2 shadow-none focus:ring-0"
        >
          <Languages className="size-4" />
          <SelectValue>
            {AVAILABLE_LANGUAGES.find((l) => l.code === i18n.language)?.native_name ??
              i18n.language}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {AVAILABLE_LANGUAGES.map((lang) => (
            <SelectItem key={lang.code} value={lang.code}>
              {lang.native_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
