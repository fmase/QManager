"use client";

import { useId, useMemo } from "react";
import { useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

interface MiniSparklineProps {
  /** Recent per-poll deltas, oldest first. */
  data: number[];
  /** When false, render a calm dormant baseline with no fill or animation. */
  active?: boolean;
  width?: number;
  height?: number;
  className?: string;
}

const STROKE_WIDTH = 1.5;
// Headroom so the peak never touches the top edge — the line gets room to breathe.
const TOP_PAD = 0.12;

/**
 * Hand-rolled area sparkline (no chart library). The "throughput pulse" of the
 * Traffic Engine hero: an indigo area whose tail draws in via stroke-dashoffset
 * when a new point lands. Dormant when idle — a single flat resting baseline
 * reads "ready", not "no data". Reduced-motion users get the final shape
 * instantly.
 */
export function MiniSparkline({
  data,
  active = true,
  width = 240,
  height = 72,
  className,
}: MiniSparklineProps) {
  const reduceMotion = useReducedMotion();
  const gradientId = useId();

  const { linePath, areaPath, hasShape } = useMemo(() => {
    const baselineY = height - STROKE_WIDTH / 2;

    // Need at least two points to draw a meaningful contour.
    if (!active || data.length < 2) {
      return {
        linePath: `M ${STROKE_WIDTH / 2} ${baselineY} L ${width - STROKE_WIDTH / 2} ${baselineY}`,
        areaPath: "",
        hasShape: false,
      };
    }

    const max = Math.max(...data, 1);
    const topY = height * TOP_PAD;
    const usableH = baselineY - topY;
    const stepX =
      data.length > 1
        ? (width - STROKE_WIDTH) / (data.length - 1)
        : 0;

    const points = data.map((d, i) => {
      const x = STROKE_WIDTH / 2 + i * stepX;
      const norm = Math.max(0, Math.min(1, d / max));
      const y = baselineY - norm * usableH;
      return [x, y] as const;
    });

    const line = points
      .map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`)
      .join(" ");

    const first = points[0];
    const last = points[points.length - 1];
    const area =
      `M ${first[0].toFixed(2)} ${baselineY.toFixed(2)} ` +
      points.map(([x, y]) => `L ${x.toFixed(2)} ${y.toFixed(2)}`).join(" ") +
      ` L ${last[0].toFixed(2)} ${baselineY.toFixed(2)} Z`;

    return { linePath: line, areaPath: area, hasShape: true };
  }, [data, active, width, height]);

  // Re-key the stroke on the latest value so the dash-draw replays on each tick.
  const drawKey = active ? `${data.length}:${data[data.length - 1] ?? 0}` : "idle";

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      className={cn("overflow-visible", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity={0.18} />
          <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
        </linearGradient>
      </defs>

      {hasShape && (
        <path
          d={areaPath}
          className="text-chart-3 transition-opacity duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
          fill={`url(#${gradientId})`}
          stroke="none"
        />
      )}

      <path
        key={drawKey}
        d={linePath}
        className={cn(
          hasShape ? "text-chart-3" : "text-border",
          !reduceMotion && hasShape && "animate-spark-draw",
        )}
        fill="none"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        pathLength={1}
      />
    </svg>
  );
}
