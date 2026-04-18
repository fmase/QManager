import enCommon from "@/public/locales/en/common.json";
import enSidebar from "@/public/locales/en/sidebar.json";
import enDashboard from "@/public/locales/en/dashboard.json";
import enOnboarding from "@/public/locales/en/onboarding.json";
import enSystemSettings from "@/public/locales/en/system-settings.json";
import enLocalNetwork from "@/public/locales/en/local-network.json";
import zhCNCommon from "@/public/locales/zh-CN/common.json";
import zhCNSidebar from "@/public/locales/zh-CN/sidebar.json";
import zhCNDashboard from "@/public/locales/zh-CN/dashboard.json";
import zhCNOnboarding from "@/public/locales/zh-CN/onboarding.json";
import zhCNSystemSettings from "@/public/locales/zh-CN/system-settings.json";
import zhCNLocalNetwork from "@/public/locales/zh-CN/local-network.json";

// Resources for i18next. Every bundled language must declare every namespace.
// New namespaces added in a future plan (cellular, monitoring, etc.) get wired here.
export const resources = {
  en: {
    common: enCommon,
    sidebar: enSidebar,
    dashboard: enDashboard,
    onboarding: enOnboarding,
    "system-settings": enSystemSettings,
    "local-network": enLocalNetwork,
  },
  "zh-CN": {
    common: zhCNCommon,
    sidebar: zhCNSidebar,
    dashboard: zhCNDashboard,
    onboarding: zhCNOnboarding,
    "system-settings": zhCNSystemSettings,
    "local-network": zhCNLocalNetwork,
  },
} as const;

export const DEFAULT_NAMESPACE = "common" as const;
export const ALL_NAMESPACES = ["common", "sidebar", "dashboard", "onboarding", "system-settings", "local-network"] as const;
