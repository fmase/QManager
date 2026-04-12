"use client";

import { useEffect } from "react";

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
import {
  RefreshCcwIcon,
  Clock,
  MessageSquareIcon,
  AlertCircle,
  CheckCircle2Icon,
  XCircleIcon,
} from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { useSmsAlertLog } from "@/hooks/use-sms-alert-log";

// =============================================================================
// SmsAlertsLogCard — Log of sent/failed SMS alerts
// =============================================================================

interface SmsAlertsLogCardProps {
  refreshKey?: number;
}

const SmsAlertsLogCard = ({ refreshKey }: SmsAlertsLogCardProps) => {
  const {
    entries,
    total,
    isLoading,
    isRefreshing,
    error,
    lastFetched,
    refresh,
    silentRefresh,
  } = useSmsAlertLog();

  useEffect(() => {
    if (refreshKey) {
      silentRefresh();
    }
  }, [refreshKey, silentRefresh]);

  // --- Loading skeleton ------------------------------------------------------
  if (isLoading) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>Alert Log</CardTitle>
          <CardDescription>
            History of sent and failed SMS alerts.
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
  if (!isLoading && error && entries.length === 0) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>Alert Log</CardTitle>
          <CardDescription>
            History of sent and failed SMS alerts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Failed to load alert log</AlertTitle>
            <AlertDescription>
              <p>{error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={refresh}
              >
                <RefreshCcwIcon className="size-3.5" />
                Retry
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
            <CardTitle>Alert Log</CardTitle>
            <CardDescription>
              History of sent and failed SMS alerts.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="icon"
            aria-label="Refresh alert log"
            disabled={isRefreshing}
            onClick={refresh}
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
                  Timestamp
                </TableHead>
                <TableHead scope="col">Trigger</TableHead>
                <TableHead scope="col" className="w-20">
                  Status
                </TableHead>
                <TableHead scope="col" className="hidden @md/card:table-cell">
                  Recipient
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody aria-live="polite" aria-relevant="additions">
              {entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <MessageSquareIcon className="size-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        No alerts sent yet
                      </p>
                      <div className="grid gap-1">
                        <p className="text-xs text-muted-foreground/70">
                          Alerts appear here when your connection drops past
                          the configured threshold.
                        </p>
                        <p className="text-xs text-muted-foreground/70">
                          Use Send Test SMS to verify your setup.
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
                      <span className="block text-xs text-muted-foreground font-mono truncate @md/card:hidden">
                        {entry.recipient}
                      </span>
                    </TableCell>
                    <TableCell>
                      {entry.status === "sent" ? (
                        <Badge
                          variant="outline"
                          className="bg-success/15 text-success hover:bg-success/20 border-success/30"
                        >
                          <CheckCircle2Icon className="size-3" />
                          Sent
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="bg-destructive/15 text-destructive hover:bg-destructive/20 border-destructive/30"
                        >
                          <XCircleIcon className="size-3" />
                          Failed
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="hidden @md/card:table-cell text-sm text-muted-foreground">
                      <span className="block truncate font-mono text-xs">
                        {entry.recipient}
                      </span>
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
            Showing <strong>{entries.length}</strong> of{" "}
            <strong>{total}</strong> entries
          </div>
          {lastFetched && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="size-3 shrink-0" />
              Last updated: {lastFetched.toLocaleTimeString()}
            </div>
          )}
        </CardFooter>
      )}
    </Card>
  );
};

export default SmsAlertsLogCard;
