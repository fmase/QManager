import enCommon from "@/public/locales/en/common.json";
import enSidebar from "@/public/locales/en/sidebar.json";
import zhCNCommon from "@/public/locales/zh-CN/common.json";
import zhCNSidebar from "@/public/locales/zh-CN/sidebar.json";

// Resources for i18next. Every bundled language must declare every namespace.
// New namespaces added in a future plan (dashboard, cellular, etc.) get wired here.
export const resources = {
  en: {
    common: enCommon,
    sidebar: enSidebar,
  },
  "zh-CN": {
    common: zhCNCommon,
    sidebar: zhCNSidebar,
  },
} as const;

export const DEFAULT_NAMESPACE = "common" as const;
export const ALL_NAMESPACES = ["common", "sidebar"] as const;
