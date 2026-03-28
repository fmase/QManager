"use client";

import { motion } from "motion/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { FaCircle } from "react-icons/fa6";
import type { CarrierComponent } from "@/types/modem-status";
import { RSRP_THRESHOLDS, getSignalQuality } from "@/types/modem-status";

interface SccStatusProps {
  carriers: CarrierComponent[];
  isLoading: boolean;
}

// Reuse the same stagger pattern as SignalStatusCard
const listVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.04 } },
};
const rowVariants = {
  hidden: { opacity: 0, y: 5 },
  visible: { opacity: 1, y: 0 },
};

function getValueColorClass(quality: string): string {
  switch (quality) {
    case "excellent":
    case "good":
      return "text-success";
    case "fair":
      return "text-warning";
    case "poor":
      return "text-destructive";
    default:
      return "";
  }
}

const SccStatusComponent = ({ carriers, isLoading }: SccStatusProps) => {
  const sccCarriers = carriers.filter((c) => c.type === "SCC");
  const hasCarriers = sccCarriers.length > 0;
  const totalBw = sccCarriers.reduce(
    (sum, c) => sum + (c.bandwidth_mhz || 0),
    0,
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">
            Secondary Carriers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="flex items-center justify-between">
              <div className="grid gap-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <div className="grid divide-y divide-border border-y border-border">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between py-2">
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-36" />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">
          Secondary Carriers
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          {/* Summary — mirrors SignalStatusCard's signal strength header */}
          <div className="flex items-center justify-between">
            <div className="grid gap-0.5">
              <h3 className="text-sm font-semibold">Carrier Aggregation</h3>
              <div className="flex items-center gap-x-1">
                <FaCircle
                  className={cn(
                    "w-2 h-2",
                    hasCarriers ? "text-success" : "text-muted-foreground",
                  )}
                  aria-hidden
                />
                <p className="text-muted-foreground text-xs">
                  {hasCarriers
                    ? `${sccCarriers.length} active carrier${sccCarriers.length !== 1 ? "s" : ""}`
                    : "No active carriers"}
                </p>
              </div>
            </div>
            {hasCarriers && (
              <Badge
                variant="outline"
                className="bg-info/15 text-info hover:bg-info/20 border-info/30 tabular-nums"
              >
                +{totalBw} MHz
              </Badge>
            )}
          </div>

          {/* Carrier rows — same divider + stagger pattern as SignalStatusCard */}
          {hasCarriers && (
            <motion.div
              className="grid divide-y divide-border border-y border-border"
              variants={listVariants}
              initial="hidden"
              animate="visible"
            >
              {sccCarriers.map((carrier, index) => {
                const quality = getSignalQuality(carrier.rsrp, RSRP_THRESHOLDS);
                const rsrpColor = getValueColorClass(quality);

                return (
                  <motion.div
                    key={`${carrier.band}-${carrier.pci}-${index}`}
                    variants={rowVariants}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    className="flex items-center justify-between py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">
                        {carrier.band}
                      </span>
                      <span className="text-muted-foreground text-sm">
                        ({carrier.pci ?? "-"})
                      </span>
                    </div>

                    {carrier.rsrp != null && (
                      <span className={cn("font-semibold text-sm", rsrpColor)}>
                        {carrier.rsrp} dBm
                      </span>
                    )}
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default SccStatusComponent;
