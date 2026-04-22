"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { authFetch } from "@/lib/auth-fetch";
import { resolveErrorMessage } from "@/lib/i18n/resolve-error";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { motion } from "motion/react";

const MotionTableRow = motion.create(TableRow);

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCcwIcon, Clock, MailIcon, AlertCircle, CheckCircle2Icon, XCircleIcon } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

// =============================================================================
// EmailAlertsLogCard — Self-contained log of sent/failed email alerts
// =============================================================================

const CGI_ENDPOINT = "/cgi-bin/quecmanager/monitoring/email_alert_log.sh";

interface EmailLogEntry {
  timestamp: string;
  trigger: string;
  status: "sent" | "failed";
  recipient: string;
}

interface EmailLogResponse {
  success: boolean;
  entries: EmailLogEntry[];
  total: number;
  error?: string;
}

interface EmailAlertsLogCardProps {
  refreshKey?: number;
}

const EmailAlertsLogCard = ({ refreshKey }: EmailAlertsLogCardProps) => {
  const { t } = useTranslation("monitoring");
  const [entries, setEntries] = useState<EmailLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  // AbortController for clean fetch cancellation on unmount
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Fetch log entries
  // ---------------------------------------------------------------------------
  const fetchLog = useCallback(
    async (mode: "initial" | "refresh" | "silent" = "initial") => {
      // Cancel any in-flight request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      if (mode === "initial") setIsLoading(true);
      if (mode === "refresh") setIsRefreshing(true);
      setFetchError(null);

      try {
        const resp = await authFetch(CGI_ENDPOINT, {
          signal: controller.signal,
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

        const data: EmailLogResponse = await resp.json();
        if (controller.signal.aborted) return;

        if (data.success) {
          setEntries(data.entries);
          setTotal(data.total);
          setLastFetched(new Date());
        } else {
          const msg = resolveErrorMessage(t, data.error, undefined, t("email_alerts.log_error_title"));
          setFetchError(msg);
          if (mode !== "silent") toast.error(msg);
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        const msg =
          err instanceof Error ? err.message : t("email_alerts.log_error_title");
        setFetchError(msg);
        if (mode !== "silent") toast.error(msg);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [t],
  );

  useEffect(() => {
    fetchLog("initial");
  }, [fetchLog]);

  // Re-fetch when parent signals a refresh (e.g. after sending a test email)
  useEffect(() => {
    if (refreshKey) {
      fetchLog("silent");
    }
  }, [refreshKey, fetchLog]);

  // --- Loading skeleton ------------------------------------------------------
  if (isLoading) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>{t("email_alerts.log_card_title")}</CardTitle>
          <CardDescription>
            {t("email_alerts.log_card_description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <div className="border-b px-4 py-3">
              <div className="flex gap-4">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-14" />
              </div>
            </div>
            <div className="divide-y">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-5 w-12 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // --- Error state (initial fetch failed) ------------------------------------
  if (!isLoading && fetchError && entries.length === 0) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>{t("email_alerts.log_card_title")}</CardTitle>
          <CardDescription>
            {t("email_alerts.log_card_description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>{t("email_alerts.log_error_title")}</AlertTitle>
            <AlertDescription>
              <p>{fetchError}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => fetchLog("initial")}
              >
                <RefreshCcwIcon className="size-3.5" />
                {t("actions.retry", { ns: "common" })}
              </Button>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // --- Render ----------------------------------------------------------------
  return (
    <Card className="@container/card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{t("email_alerts.log_card_title")}</CardTitle>
            <CardDescription>
              {t("email_alerts.log_card_description")}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="icon"
            aria-label={t("email_alerts.log_aria_refresh")}
            disabled={isRefreshing}
            onClick={() => fetchLog("refresh")}
          >
            <RefreshCcwIcon
              className={cn("size-4", isRefreshing && "animate-spin")}
            />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead scope="col" className="whitespace-nowrap">
                  {t("email_alerts.log_header_timestamp")}
                </TableHead>
                <TableHead scope="col">{t("email_alerts.log_header_trigger")}</TableHead>
                <TableHead scope="col" className="w-20">
                  {t("email_alerts.log_header_status")}
                </TableHead>
                <TableHead scope="col" className="hidden @md/card:table-cell">
                  {t("email_alerts.log_header_recipient")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody aria-live="polite" aria-relevant="additions">
              {entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <MailIcon className="size-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        {t("email_alerts.log_empty_title")}
                      </p>
                      <div className="grid gap-1">
                        <p className="text-xs text-muted-foreground/70 ">
                          {t("email_alerts.log_empty_hint_1")}
                        </p>
                        <p className="text-xs text-muted-foreground/70">
                          {t("email_alerts.log_empty_hint_2")}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((entry, index) => (
                  <MotionTableRow
                    key={`${entry.timestamp}-${index}`}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      duration: 0.2,
                      delay: Math.min(index * 0.04, 0.4),
                      ease: "easeOut",
                    }}
                  >
                    <TableCell className="font-mono text-xs whitespace-nowrap">
                      {entry.timestamp}
                    </TableCell>
                    <TableCell className="text-sm min-w-0">
                      <span className="block truncate">{entry.trigger}</span>
                      <span className="block text-xs text-muted-foreground truncate @md/card:hidden">
                        {entry.recipient}
                      </span>
                    </TableCell>
                    <TableCell>
                      {entry.status === "sent" ? (
                        <Badge variant="outline" className="bg-success/15 text-success hover:bg-success/20 border-success/30">
                          <CheckCircle2Icon className="h-3 w-3" />
                          {t("email_alerts.log_badge_sent")}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-destructive/15 text-destructive hover:bg-destructive/20 border-destructive/30">
                          <XCircleIcon className="h-3 w-3" />
                          {t("email_alerts.log_badge_failed")}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="hidden @md/card:table-cell text-sm text-muted-foreground">
                      <span className="block truncate">{entry.recipient}</span>
                    </TableCell>
                  </MotionTableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      {entries.length > 0 && (
        <CardFooter className="flex flex-col gap-1 @xs/card:flex-row @xs/card:justify-between @xs/card:items-center">
          <div className="text-xs text-muted-foreground">
            {t("email_alerts.log_showing_count", { count: total, shown: entries.length, total })}
          </div>
          {lastFetched && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="size-3 shrink-0" />
              {t("email_alerts.log_last_updated", { time: lastFetched.toLocaleTimeString() })}
            </div>
          )}
        </CardFooter>
      )}
    </Card>
  );
};

export default EmailAlertsLogCard;
