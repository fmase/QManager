"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, RefreshCcw } from "lucide-react";

import type { AboutDeviceData } from "@/types/about-device";

// =============================================================================
// DeviceInformationCard — Modem image + device identity & network addresses
// =============================================================================

interface DataRow {
  label: string;
  value: string;
  mono?: boolean;
}

interface DataSection {
  title: string;
  rows: DataRow[];
}

interface DeviceInformationCardProps {
  data: AboutDeviceData | null;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
}

function buildSections(data: AboutDeviceData): DataSection[] {
  return [
    {
      title: "Device",
      rows: [
        { label: "Manufacturer", value: data.device.manufacturer },
        { label: "Model", value: data.device.model },
        { label: "Firmware", value: data.device.firmware },
        { label: "Build Date", value: data.device.build_date },
        { label: "IMEI", value: data.device.imei, mono: true },
        {
          label: "3GPP Release (LTE)",
          value: data.threeGppRelease.lte,
        },
        {
          label: "3GPP Release (NR5G)",
          value: data.threeGppRelease.nr5g,
        },
      ],
    },
    {
      title: "System",
      rows: [
        { label: "Hostname", value: data.system.hostname },
        {
          label: "OpenWRT Version",
          value: data.system.openwrt_version,
          mono: true,
        },
        {
          label: "Kernel Version",
          value: data.system.kernel_version,
          mono: true,
        },
      ],
    },
  ];
}

// ─── Loading skeleton ────────────────────────────────────────────────────────

function DeviceInformationSkeleton() {
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold">
          Device Information
        </CardTitle>
        <CardDescription>
          Modem identity and system details.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-center mb-8">
          <Skeleton className="size-44 rounded-full" />
        </div>
        <div className="grid divide-y divide-border border-y border-border">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-36" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

const DeviceInformationCard = ({
  data,
  isLoading,
  error,
  onRetry,
}: DeviceInformationCardProps) => {
  if (isLoading) {
    return <DeviceInformationSkeleton />;
  }

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold">
          Device Information
        </CardTitle>
        <CardDescription>
          Modem identity and system details.
        </CardDescription>
      </CardHeader>
      <CardContent aria-live="polite">
        {error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Failed to load device information</AlertTitle>
            <AlertDescription className="flex items-center justify-between">
              <span>{error}</span>
              <Button variant="outline" size="sm" onClick={onRetry}>
                <RefreshCcw className="size-3.5 mr-1.5" />
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        ) : data ? (
          <div className="grid gap-4">
            {/* Modem image */}
            <div className="flex items-center justify-center mb-4">
              <div className="size-44 bg-primary/15 rounded-full p-4 flex items-center justify-center">
                <img
                  src="/device-icon.svg"
                  alt={data.device.model ? `${data.device.model} modem` : "Modem"}
                  className="size-full drop-shadow-md object-contain"
                />
              </div>
            </div>

            {/* Data sections */}
            {buildSections(data).map((section) => (
              <div key={section.title}>
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  {section.title}
                </h3>
                <dl className="grid divide-y divide-border border-y border-border">
                  {section.rows.map((row) => (
                    <div
                      key={row.label}
                      className="flex items-center justify-between py-2"
                    >
                      <dt className="text-sm font-semibold text-muted-foreground">
                        {row.label}
                      </dt>
                      <dd
                        className={`text-sm font-semibold min-w-0 truncate ml-4 ${
                          row.mono ? "tabular-nums" : ""
                        }`}
                        title={row.value || undefined}
                      >
                        {row.value || "-"}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};

export default DeviceInformationCard;
