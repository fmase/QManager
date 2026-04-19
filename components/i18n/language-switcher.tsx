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
import { fetchLanguagePackList } from "@/lib/i18n/language-pack-client";
import { DEFAULT_MANIFEST_URL } from "@/lib/i18n/language-pack-manifest";
import type { LanguageCode } from "@/types/i18n";

export function LanguageSwitcher({ className }: { className?: string }) {
  const { t, i18n } = useTranslation("common");
  const [installedCodes, setInstalledCodes] = React.useState<LanguageCode[]>([]);

  React.useEffect(() => {
    let mounted = true;
    // Best-effort — if the list CGI fails we still show bundled languages.
    (async () => {
      try {
        const res = await fetchLanguagePackList(DEFAULT_MANIFEST_URL);
        if (!mounted) return;
        setInstalledCodes(res.installed.map((i) => i.code));
      } catch {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const visibleLanguages = React.useMemo(() => {
    return AVAILABLE_LANGUAGES.filter(
      (l) => l.bundled || installedCodes.includes(l.code),
    );
  }, [installedCodes]);

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
            {visibleLanguages.find((l) => l.code === i18n.language)?.native_name ??
              AVAILABLE_LANGUAGES.find((l) => l.code === i18n.language)?.native_name ??
              i18n.language}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {visibleLanguages.map((lang) => (
            <SelectItem key={lang.code} value={lang.code}>
              {lang.native_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
