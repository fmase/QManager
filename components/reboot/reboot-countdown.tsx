"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Spinner } from "@/components/ui/spinner";

const TOTAL_SECONDS = 70;
const POLL_START_AT = 35; // seconds remaining when polling begins
const POLL_INTERVAL = 5000; // ms between polls
const REDIRECT_DELAY = 3000; // ms to wait after device responds before redirecting
const CHECK_ENDPOINT = "/cgi-bin/quecmanager/auth/check.sh";

// SVG ring geometry
const RING_SIZE = 120;
const RING_RADIUS = 52;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const RING_STROKE = 5;

interface Phase {
  label: string;
  segment: number; // 1-indexed active segment
}

function getPhase(remaining: number): Phase {
  if (remaining > 47) return { label: "Shutting down...", segment: 1 };
  if (remaining > 23) return { label: "Restarting services...", segment: 2 };
  if (remaining > 0) return { label: "Almost ready...", segment: 3 };
  return { label: "Reconnecting \u2014 taking longer than usual...", segment: 3 };
}

export function RebootCountdown() {
  const [remaining, setRemaining] = useState(TOTAL_SECONDS);
  const pollingRef = useRef(false);
  const remainingRef = useRef(TOTAL_SECONDS);

  // Keep ref in sync so the polling effect can read it without re-subscribing
  useEffect(() => {
    remainingRef.current = remaining;
  }, [remaining]);

  // Countdown timer
  useEffect(() => {
    const id = setInterval(() => {
      setRemaining((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Device health polling — single interval, checks remainingRef each tick
  useEffect(() => {
    const id = setInterval(async () => {
      // Don't poll until countdown reaches the threshold
      if (remainingRef.current > POLL_START_AT) return;
      if (pollingRef.current) return;
      pollingRef.current = true;
      try {
        const res = await fetch(CHECK_ENDPOINT);
        if (res.ok) {
          clearInterval(id);
          // Wait a few seconds for the poller to initialize
          // so the dashboard isn't blank on first load
          setTimeout(() => {
            window.location.href = "/login/";
          }, REDIRECT_DELAY);
          return;
        }
      } catch {
        // Device still offline
      }
      pollingRef.current = false;
    }, POLL_INTERVAL);

    return () => clearInterval(id);
  }, []);

  const phase = getPhase(remaining);
  const isOvertime = remaining <= 0;
  const displaySeconds = Math.max(0, remaining);

  // Ring progress: 0 at start → full at 0 remaining
  const progress = Math.min(1, (TOTAL_SECONDS - remaining) / TOTAL_SECONDS);
  const dashOffset = RING_CIRCUMFERENCE * (1 - progress);

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background p-6">
      {/* Card */}
      <div className="flex flex-col items-center gap-6 rounded-xl border border-border/50 bg-card px-12 py-10 shadow-lg max-w-[340px] w-full">
        {/* Logo */}
        <img
          src="/qmanager-logo.svg"
          alt="QManager"
          className="size-9"
        />

        {/* Progress ring with countdown */}
        <div className="relative" style={{ width: RING_SIZE, height: RING_SIZE }}>
          <svg
            width={RING_SIZE}
            height={RING_SIZE}
            viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
            className="-rotate-90"
          >
            {/* Background track */}
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              fill="none"
              className="stroke-muted/20"
              strokeWidth={RING_STROKE}
            />
            {/* Progress arc */}
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              fill="none"
              className="stroke-primary"
              strokeWidth={RING_STROKE}
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              style={{
                transition: "stroke-dashoffset 1s linear",
                filter: "drop-shadow(0 0 6px hsl(var(--primary) / 0.3))",
              }}
            />
          </svg>

          {/* Countdown number */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {isOvertime ? (
              <Spinner className="size-6" />
            ) : (
              <>
                <span className="text-[32px] font-semibold leading-none tracking-tight text-foreground tabular-nums">
                  {displaySeconds}
                </span>
                <span className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                  sec
                </span>
              </>
            )}
          </div>
        </div>

        {/* Phase message */}
        <div className="text-center min-h-[48px] flex flex-col items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={phase.label}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
            >
              <p className="text-[15px] font-medium text-foreground">
                {phase.label}
              </p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                {isOvertime
                  ? "The device is still restarting"
                  : "Your device will be back online shortly"}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Segmented progress bar */}
        <div className="flex w-full gap-1.5">
          {[1, 2, 3].map((seg) => (
            <div
              key={seg}
              className="h-[3px] flex-1 rounded-full transition-colors duration-500"
              style={{
                backgroundColor:
                  seg < phase.segment
                    ? "hsl(var(--primary))"
                    : seg === phase.segment
                      ? "hsl(var(--primary) / 0.6)"
                      : "hsl(var(--muted) / 0.3)",
              }}
            />
          ))}
        </div>
      </div>

      {/* Brand text below card */}
      <p className="mt-5 text-xs text-muted-foreground/40">QManager</p>
    </div>
  );
}
