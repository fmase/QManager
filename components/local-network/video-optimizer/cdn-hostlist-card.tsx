"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SaveButton, useSaveFlash } from "@/components/ui/save-button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FieldError } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle,
  ArrowDownAZIcon,
  ArrowUpAZIcon,
  Download,
  Loader2,
  MoreVerticalIcon,
  Plus,
  RefreshCcwIcon,
  RotateCcw,
  SparklesIcon,
  Upload,
  X,
} from "lucide-react";
import { useCdnHostlist } from "@/hooks/use-cdn-hostlist";

const DOMAIN_REGEX = /^[a-zA-Z0-9]([a-zA-Z0-9._-]*[a-zA-Z0-9])?$/;

function validateDomain(
  value: string,
  existing: string[],
  t: (key: string) => string,
): string | null {
  const trimmed = value.trim();
  if (!trimmed) return t("video_optimizer.validation_domain_required");
  if (!DOMAIN_REGEX.test(trimmed)) return t("video_optimizer.validation_domain_invalid_format");
  if (!trimmed.includes(".")) return t("video_optimizer.validation_domain_needs_dot");
  if (trimmed.length > 253) return t("video_optimizer.validation_domain_too_long");
  if (existing.some((d) => d.toLowerCase() === trimmed.toLowerCase()))
    return t("video_optimizer.validation_domain_duplicate");
  return null;
}

function HostlistSkeleton() {
  return (
    <Card className="@container/card">
      <CardHeader>
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-4 w-72" />
      </CardHeader>
      <CardContent className="grid gap-4">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-9 w-full" />
      </CardContent>
    </Card>
  );
}

export default function CdnHostlistCard() {
  const { t } = useTranslation("local-network");
  const {
    domains,
    defaultDomains,
    isLoading,
    isSaving,
    isRestoring,
    error,
    saveHostlist,
    restoreDefaults,
    refresh,
  } = useCdnHostlist();

  const [editDomains, setEditDomains] = useState<string[]>([]);
  const [newDomain, setNewDomain] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState<boolean | null>(null);
  const { saved, markSaved } = useSaveFlash();
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditDomains(domains);
  }, [domains]);

  // Build a set of lowercase default domains for O(1) lookup
  const defaultSet = useMemo(
    () => new Set(defaultDomains.map((d) => d.toLowerCase())),
    [defaultDomains],
  );

  const isDirty = useMemo(() => {
    if (editDomains.length !== domains.length) return true;
    const sortedEdit = [...editDomains].sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase()),
    );
    const sortedSaved = [...domains].sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase()),
    );
    return sortedEdit.some(
      (d, i) => d.toLowerCase() !== sortedSaved[i].toLowerCase(),
    );
  }, [editDomains, domains]);

  // Sorted view of domains for display
  const displayDomains = useMemo(() => {
    if (sortAsc === null) return editDomains.map((d, i) => ({ domain: d, originalIndex: i }));
    const indexed = editDomains.map((d, i) => ({ domain: d, originalIndex: i }));
    return indexed.sort((a, b) => {
      const cmp = a.domain.toLowerCase().localeCompare(b.domain.toLowerCase());
      return sortAsc ? cmp : -cmp;
    });
  }, [editDomains, sortAsc]);

  const customCount = useMemo(
    () => editDomains.filter((d) => !defaultSet.has(d.toLowerCase())).length,
    [editDomains, defaultSet],
  );

  const handleAddDomain = useCallback(() => {
    const trimmed = newDomain.trim();
    const err = validateDomain(trimmed, editDomains, t);
    if (err) {
      setValidationError(err);
      return;
    }
    setEditDomains((prev) => [...prev, trimmed]);
    setNewDomain("");
    setValidationError(null);
  }, [newDomain, editDomains, t]);

  const handleRemoveDomain = useCallback((originalIndex: number) => {
    setEditDomains((prev) => prev.filter((_, i) => i !== originalIndex));
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAddDomain();
      }
    },
    [handleAddDomain],
  );

  const handleSave = useCallback(async () => {
    const success = await saveHostlist(editDomains);
    if (success) {
      markSaved();
      toast.success(t("video_optimizer.toast_save_success"));
    } else {
      toast.error(error || t("video_optimizer.toast_save_error"));
    }
  }, [editDomains, saveHostlist, markSaved, error, t]);

  const handleReset = useCallback(() => {
    setEditDomains(domains);
    setValidationError(null);
  }, [domains]);

  const handleRestoreDefaults = useCallback(async () => {
    const success = await restoreDefaults();
    if (success) {
      toast.success(t("video_optimizer.toast_restore_success"));
    } else {
      toast.error(error || t("video_optimizer.toast_restore_error"));
    }
  }, [restoreDefaults, error, t]);

  // --- Export: download current edit list as .txt ---
  const handleExport = useCallback(() => {
    const content = editDomains.join("\n") + "\n";
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "video_domains.txt";
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t("video_optimizer.toast_export_success", { count: editDomains.length }));
  }, [editDomains, t]);

  // --- Import: read .txt file and merge ---
  const handleImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result;
        if (typeof text !== "string") return;

        const imported = text
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line && !line.startsWith("#"));

        // Merge: add only domains not already in the list
        const existingLower = new Set(
          editDomains.map((d) => d.toLowerCase()),
        );
        const newOnes = imported.filter(
          (d) => !existingLower.has(d.toLowerCase()),
        );

        if (newOnes.length === 0) {
          toast.info(t("video_optimizer.toast_import_no_new"));
        } else {
          setEditDomains((prev) => [...prev, ...newOnes]);
          toast.success(t("video_optimizer.toast_import_success", { count: newOnes.length }));
        }
      };
      reader.readAsText(file);

      // Reset input so the same file can be re-imported
      e.target.value = "";
    },
    [editDomains, t],
  );

  const toggleSort = useCallback(() => {
    setSortAsc((prev) => {
      if (prev === null) return true;
      if (prev === true) return false;
      return null;
    });
  }, []);

  if (isLoading) return <HostlistSkeleton />;

  if (error && domains.length === 0) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>{t("video_optimizer.hostlist_card_title")}</CardTitle>
          <CardDescription>
            {t("video_optimizer.hostlist_card_description")}
          </CardDescription>
        </CardHeader>
        <CardContent aria-live="polite">
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>{t("video_optimizer.hostlist_error_load_failed")}</span>
              <Button variant="outline" size="sm" onClick={() => refresh()}>
                <RefreshCcwIcon className="size-3.5" />
                {t("actions.retry", { ns: "common" })}
              </Button>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>{t("video_optimizer.hostlist_card_title")}</CardTitle>
        <CardDescription>
          {t("video_optimizer.hostlist_card_description")}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4" aria-live="polite">
        {/* Toolbar: count badges + sort + menu */}
        <div className="flex items-center gap-2">
          <Badge>{t("video_optimizer.badge_domain_count", { count: editDomains.length })}</Badge>
          {customCount > 0 && (
            <Badge
              variant="outline"
              className="bg-info/15 text-info border-info/30"
            >
              <SparklesIcon className="size-3" />
              {t("video_optimizer.badge_custom_count", { custom_count: customCount })}
            </Badge>
          )}
          <div className="flex-1" />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={toggleSort}
            aria-label={
              sortAsc === null
                ? t("video_optimizer.aria_sort_az")
                : sortAsc
                  ? t("video_optimizer.aria_sort_za")
                  : t("video_optimizer.aria_sort_clear")
            }
          >
            {sortAsc === false ? (
              <ArrowUpAZIcon className="size-4" />
            ) : (
              <ArrowDownAZIcon className="size-4" />
            )}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={t("video_optimizer.aria_menu_options")}
              >
                <MoreVerticalIcon className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExport}>
                <Download className="size-4" />
                {t("video_optimizer.menu_export")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => importRef.current?.click()}>
                <Upload className="size-4" />
                {t("video_optimizer.menu_import")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleReset} disabled={!isDirty}>
                <RotateCcw className="size-4" />
                {t("video_optimizer.menu_discard")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {/* Hidden file input for import */}
          <input
            ref={importRef}
            type="file"
            accept=".txt,.csv,text/plain"
            className="hidden"
            onChange={handleImport}
          />
        </div>

        {/* Add domain input */}
        <div className="space-y-1.5">
          <InputGroup>
            <InputGroupInput
              type="text"
              placeholder={t("video_optimizer.placeholder_new_domain")}
              value={newDomain}
              onChange={(e) => {
                setNewDomain(e.target.value);
                if (validationError) setValidationError(null);
              }}
              onKeyDown={handleKeyDown}
              aria-label={t("video_optimizer.aria_new_domain")}
              aria-invalid={!!validationError}
              aria-describedby={
                validationError ? "add-domain-error" : undefined
              }
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="sm"
                variant="ghost"
                onClick={handleAddDomain}
                aria-label={t("video_optimizer.aria_add_domain")}
              >
                <Plus className="size-4" />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          {validationError && (
            <FieldError id="add-domain-error">{validationError}</FieldError>
          )}
        </div>

        {/* Domain list */}
        <div className="max-h-100 overflow-y-auto rounded-md border">
          {displayDomains.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              {t("video_optimizer.empty_state_no_domains")}
            </div>
          ) : (
            displayDomains.map(({ domain, originalIndex }) => {
              const isCustom = !defaultSet.has(domain.toLowerCase());
              return (
                <div
                  key={`${domain}-${originalIndex}`}
                  className="flex items-center justify-between px-3 py-2 text-sm even:bg-muted/30"
                >
                  <span className="flex items-center gap-2 truncate">
                    <span className="truncate">{domain}</span>
                    {isCustom && (
                      <SparklesIcon
                        className="size-3 shrink-0 text-info"
                        aria-label={t("video_optimizer.aria_custom_domain_badge")}
                      />
                    )}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-6 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemoveDomain(originalIndex)}
                    aria-label={t("video_optimizer.aria_remove_domain", { domain })}
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              );
            })
          )}
        </div>

        <Separator />

        {/* Actions */}
        <div className="flex items-center gap-2">
          <SaveButton
            type="button"
            isSaving={isSaving}
            saved={saved}
            disabled={!isDirty}
            onClick={handleSave}
          />

          <div className="flex-1" />

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="outline"
                disabled={isSaving || isRestoring}
              >
                {isRestoring ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    {t("video_optimizer.state_restoring")}
                  </>
                ) : (
                  t("video_optimizer.button_restore_defaults")
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("video_optimizer.dialog_restore_title")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t("video_optimizer.dialog_restore_desc")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("actions.cancel", { ns: "common" })}</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={handleRestoreDefaults}
                >
                  {t("video_optimizer.dialog_action_restore")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
