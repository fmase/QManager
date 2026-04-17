import i18n, { type i18n as I18nInstance } from "i18next";
import { initReactI18next } from "react-i18next";
import { resources, ALL_NAMESPACES, DEFAULT_NAMESPACE } from "./resources";
import {
  AVAILABLE_LANGUAGES,
  BUNDLED_CODES,
  DEFAULT_LANGUAGE,
} from "./available-languages";
import type { LanguageCode } from "@/types/i18n";

export const LANG_STORAGE_KEY = "qmanager_lang";

function resolveDetectedLanguage(): LanguageCode {
  if (typeof localStorage !== "undefined") {
    const stored = localStorage.getItem(LANG_STORAGE_KEY);
    if (stored && AVAILABLE_LANGUAGES.some((l) => l.code === stored)) {
      return stored;
    }
  }

  const nav = typeof navigator !== "undefined" ? navigator.language : "";
  if (nav) {
    // Exact match first (handles "zh-CN" → "zh-CN").
    if (BUNDLED_CODES.includes(nav)) return nav;
    // Then base-language fallback (handles "fr-CA" → "fr").
    const base = nav.split("-")[0];
    if (BUNDLED_CODES.includes(base)) return base;
  }

  return DEFAULT_LANGUAGE;
}

export async function createI18n(): Promise<I18nInstance> {
  const initial = resolveDetectedLanguage();

  const instance = i18n.createInstance();
  await instance
    .use(initReactI18next)
    .init({
      resources,
      lng: initial,
      fallbackLng: DEFAULT_LANGUAGE,
      defaultNS: DEFAULT_NAMESPACE,
      ns: [...ALL_NAMESPACES],
      interpolation: { escapeValue: false },
      returnNull: false,
      react: { useSuspense: false },
    });

  return instance;
}

export function persistLanguage(code: LanguageCode): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(LANG_STORAGE_KEY, code);
}
