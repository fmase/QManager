"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";

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

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCcwIcon, Clock, MailIcon } from "lucide-react";

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

const EmailAlertsLogCard = () => {
  const [entries, setEntries] = useState<EmailLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Fetch log entries
  // ---------------------------------------------------------------------------
  const fetchLog = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);

    try {
      const resp = await fetch(CGI_ENDPOINT);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const data: EmailLogResponse = await resp.json();
      if (!mountedRef.current) return;

      if (data.success) {
        setEntries(data.entries);
        setTotal(data.total);
        setLastFetched(new Date());
      } else if (!silent) {
        toast.error(data.error || "Failed to load email log");
      }
    } catch {
      if (mountedRef.current && !silent) {
        toast.error("Failed to load email alert log");
      }
    } finally {
      if (mountedRef.current && !silent) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLog();
  }, [fetchLog]);

  // --- Loading skeleton ------------------------------------------------------
  if (isLoading) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>Alert Log</CardTitle>
          <CardDescription>
            History of sent and failed email alerts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
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
              History of sent and failed email alerts.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="icon"
            aria-label="Refresh alert log"
            onClick={() => fetchLog()}
          >
            <RefreshCcwIcon className="size-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-44">Timestamp</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead className="w-20">Status</TableHead>
                <TableHead className="hidden @md/card:table-cell">
                  Recipient
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <MailIcon className="h-8 w-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        No alerts sent yet
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((entry, index) => (
                  <TableRow key={`${entry.timestamp}-${index}`}>
                    <TableCell className="font-mono text-xs whitespace-nowrap">
                      {entry.timestamp}
                    </TableCell>
                    <TableCell className="text-sm">{entry.trigger}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          entry.status === "sent" ? "default" : "destructive"
                        }
                        className={
                          entry.status === "sent"
                            ? "bg-success text-success-foreground border-success"
                            : ""
                        }
                      >
                        {entry.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden @md/card:table-cell text-sm text-muted-foreground">
                      {entry.recipient}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      {entries.length > 0 && (
        <CardFooter className="flex justify-between items-center">
          <div className="text-xs text-muted-foreground">
            Showing <strong>{entries.length}</strong> of{" "}
            <strong>{total}</strong> entries
          </div>
          {lastFetched && (
            <div className="flex items-center text-xs text-muted-foreground">
              <Clock className="h-3 w-3 mr-1" />
              Last updated: {lastFetched.toLocaleTimeString()}
            </div>
          )}
        </CardFooter>
      )}
    </Card>
  );
};

export default EmailAlertsLogCard;
