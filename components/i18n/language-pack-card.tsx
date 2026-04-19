"use client";

import * as React from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AlertCircleIcon, GlobeIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguagePacks } from "@/hooks/use-language-packs";
import { buildCatalogView } from "@/lib/i18n/language-pack-manifest";
import { AVAILABLE_LANGUAGES } from "@/lib/i18n/available-languages";
import { persistLanguage } from "@/lib/i18n/config";
import { LanguagePackRow } from "./language-pack-row";
import type { LanguageCode } from "@/types/i18n";

export function LanguagePackCard() {
  const { t, i18n } = useTranslation("system-settings");
  const {
    list,
    isLoading,
    listError,
    install,
    startInstall,
    cancelInstall,
    remove,
    refetch,
  } = useLanguagePacks();

  const catalogView = React.useMemo(() => {
    return buildCatalogView({
      catalog: AVAILABLE_LANGUAGES,
      installed: list?.installed ?? [],
      manifest: list?.manifest ?? null,
    });
  }, [list]);

  const activeCode = i18n.language as LanguageCode;

  // Languages selectable as "active" = bundled + downloaded (not available-only).
  const selectableCodes = React.useMemo<LanguageCode[]>(() => {
    const bundled = AVAILABLE_LANGUAGES.filter((e) => e.bundled).map((e) => e.code);
    const downloaded = (list?.installed ?? [])
      .map((i) => i.code)
      .filter((c) => !bundled.includes(c));
    return [...bundled, ...downloaded];
  }, [list]);

  const handleSelectActive = React.useCallback(
    (code: LanguageCode) => {
      if (code === activeCode) return;
      i18n.changeLanguage(code);
      persistLanguage(code);
      if (typeof document !== "undefined") {
        const meta = AVAILABLE_LANGUAGES.find((e) => e.code === code);
        document.documentElement.lang = code;
        document.documentElement.dir = meta?.rtl ? "rtl" : "ltr";
      }
      const englishName =
        AVAILABLE_LANGUAGES.find((e) => e.code === code)?.english_name ?? code;
      toast.success(t("languages.toast.switched", { name: englishName }));
    },
    [activeCode, i18n, t],
  );

  const handleInstall = React.useCallback(
    async (code: LanguageCode) => {
      const englishName =
        list?.manifest?.packs.find((p) => p.code === code)?.english_name ?? code;
      toast.info(t("languages.toast.install_started", { name: englishName }));
      const res = await startInstall(code);
      if (!res.ok) {
        if (res.error === "install_in_progress") {
          toast.error(t("languages.toast.install_in_progress"));
        } else {
          toast.error(t("languages.toast.install_failed", { name: englishName }));
        }
      }
    },
    [list, startInstall, t],
  );

  // React to install completion toasts.
  const prevStateRef = React.useRef(install.state);
  React.useEffect(() => {
    const prev = prevStateRef.current;
    prevStateRef.current = install.state;
    if (prev === "running" && install.state === "success" && install.code) {
      const englishName =
        list?.manifest?.packs.find((p) => p.code === install.code)?.english_name ??
        install.code;
      toast.success(t("languages.toast.install_success", { name: englishName }));
    } else if (prev === "running" && install.state === "cancelled") {
      toast.info(t("languages.toast.install_cancelled"));
    }
  }, [install.state, install.code, list, t]);

  const handleRemove = React.useCallback(
    async (code: LanguageCode, isActive: boolean) => {
      const englishName =
        AVAILABLE_LANGUAGES.find((e) => e.code === code)?.english_name ?? code;
      if (isActive) {
        // Switch to English BEFORE removing, to avoid i18next resolving the
        // freshly-deleted pack.
        i18n.changeLanguage("en");
        persistLanguage("en");
        if (typeof document !== "undefined") {
          document.documentElement.lang = "en";
          document.documentElement.dir = "ltr";
        }
      }
      const res = await remove(code);
      if (!res.ok) {
        toast.error(t("languages.toast.remove_failed", { name: englishName }));
        return;
      }
      if (isActive) {
        toast.success(t("languages.toast.remove_active_switched", { name: englishName }));
      } else {
        toast.success(t("languages.toast.remove_success", { name: englishName }));
      }
    },
    [i18n, remove, t],
  );

  const activeEntry = AVAILABLE_LANGUAGES.find((e) => e.code === activeCode);

  return (
    <div className="flex flex-col gap-6">
      {/* Active language section */}
      <Card>
        <CardHeader>
          <CardTitle>{t("languages.sections.active_title")}</CardTitle>
          <CardDescription>{t("languages.sections.active_description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">{t("languages.active_switcher.label")}</label>
            <Select
              value={activeCode}
              onValueChange={(value) => handleSelectActive(value as LanguageCode)}
            >
              <SelectTrigger
                aria-label={t("languages.active_switcher.aria")}
                className="w-full sm:max-w-sm"
              >
                <GlobeIcon className="size-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {selectableCodes.map((code) => {
                  const meta = AVAILABLE_LANGUAGES.find((e) => e.code === code);
                  return (
                    <SelectItem key={code} value={code}>
                      {meta?.native_name ?? code}
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({meta?.english_name ?? code})
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {activeEntry && (
              <p className="text-xs text-muted-foreground">
                {t("languages.active_switcher.native_name_hint", { native: activeEntry.native_name })}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Installed section */}
      <Card>
        <CardHeader>
          <CardTitle>{t("languages.sections.installed_title")}</CardTitle>
          <CardDescription>{t("languages.sections.installed_description")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {catalogView.builtIn.map((row) => {
            if (row.status !== "built_in") return null;
            return (
              <LanguagePackRow
                key={row.entry.code}
                variant={{ kind: "built_in", entry: row.entry, isActive: row.entry.code === activeCode }}
                installState={install}
                onInstall={handleInstall}
                onCancelInstall={cancelInstall}
                onRemove={handleRemove}
                onSelectActive={handleSelectActive}
              />
            );
          })}
          {catalogView.downloaded.map((row) => {
            if (row.status !== "downloaded") return null;
            return (
              <LanguagePackRow
                key={row.entry.code}
                variant={{
                  kind: "downloaded",
                  entry: row.entry,
                  isActive: row.entry.code === activeCode,
                  version: row.version,
                  updateAvailableVersion: row.updateAvailableVersion,
                  manifestEntry: row.manifestEntry,
                }}
                installState={install}
                onInstall={handleInstall}
                onCancelInstall={cancelInstall}
                onRemove={handleRemove}
                onSelectActive={handleSelectActive}
              />
            );
          })}
          {catalogView.downloaded.length === 0 && (
            <p className="text-xs text-muted-foreground">{t("languages.empty_installed")}</p>
          )}
        </CardContent>
      </Card>

      {/* Available section */}
      <Card>
        <CardHeader>
          <CardTitle>{t("languages.sections.available_title")}</CardTitle>
          <CardDescription>{t("languages.sections.available_description")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" />
              <span>{t("languages.sections.available_loading")}</span>
            </div>
          ) : listError || list?.manifest_error ? (
            <div className="flex flex-col gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-4">
              <div className="flex items-center gap-2">
                <AlertCircleIcon className="size-4 text-destructive" />
                <span className="font-medium text-destructive">
                  {t("languages.manifest_error.title")}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("languages.manifest_error.description")}
              </p>
              <div>
                <Button size="sm" variant="outline" onClick={() => refetch()}>
                  {t("languages.manifest_error.retry_button")}
                </Button>
              </div>
            </div>
          ) : catalogView.available.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("languages.sections.available_empty")}</p>
          ) : (
            catalogView.available.map((row) => {
              if (row.status !== "available") return null;
              return (
                <LanguagePackRow
                  key={row.manifestEntry.code}
                  variant={{ kind: "available", manifestEntry: row.manifestEntry }}
                  installState={install}
                  onInstall={handleInstall}
                  onCancelInstall={cancelInstall}
                  onRemove={handleRemove}
                  onSelectActive={handleSelectActive}
                />
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
