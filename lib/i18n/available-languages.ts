import type { LanguageCode, LanguageMeta } from "@/types/i18n";

export const DEFAULT_LANGUAGE: LanguageCode = "en";

export const AVAILABLE_LANGUAGES: readonly LanguageMeta[] = [
  {
    code: "en",
    native_name: "English",
    english_name: "English",
    rtl: false,
    bundled: true,
  },
  {
    code: "zh-CN",
    native_name: "简体中文",
    english_name: "Simplified Chinese",
    rtl: false,
    bundled: true,
  },
];

export const BUNDLED_CODES: readonly LanguageCode[] = AVAILABLE_LANGUAGES
  .filter((l) => l.bundled)
  .map((l) => l.code);

export function getLanguage(code: LanguageCode): LanguageMeta | undefined {
  return AVAILABLE_LANGUAGES.find((l) => l.code === code);
}

export function isRtl(code: LanguageCode): boolean {
  return getLanguage(code)?.rtl ?? false;
}
