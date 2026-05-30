"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface LiveStatTileProps {
  label: string;
  /** Numeric or short-text value. Live numbers should already be formatted. */
  value: ReactNode;
  /** Optional element aligned to the label row (icon, unit, tiny pill). */
  trailing?: ReactNode;
  /** Render the value in the muted band (idle / not-yet-running). */
  muted?: boolean;
  /** Let long text (SNI domains) truncate instead of blowing out the tile. */
  truncateValue?: boolean;
  /** Native title for truncated values. */
  title?: string;
  className?: string;
}

/**
 * Live Data Tile (UniFi influence). Label on top, big tabular-nums value below.
 * Value swaps under the eye via a 200ms color transition — never a layout shift,
 * never a fade-flash. Hover lifts with ambient shadow + one-step border brighten,
 * no transform. Tiles vary in column span within the mosaic; this atom is span-
 * agnostic and fills whatever grid cell it lands in.
 */
export function LiveStatTile({
  label,
  value,
  trailing,
  muted = false,
  truncateValue = false,
  title,
  className,
}: LiveStatTileProps) {
  return (
    <div
      className={cn(
        "flex h-full flex-col rounded-lg border bg-card p-4 shadow-sm",
        "transition-[box-shadow,border-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
        "hover:border-foreground/15 hover:shadow-md",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {trailing ? <span className="shrink-0 leading-none">{trailing}</span> : null}
      </div>
      <span
        title={title}
        className={cn(
          "mt-2 text-2xl font-semibold leading-none tabular-nums",
          "transition-colors duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
          muted ? "text-muted-foreground" : "text-foreground",
          truncateValue && "truncate",
        )}
      >
        {value}
      </span>
    </div>
  );
}
