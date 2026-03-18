"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useLogin } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

const CHECK_ENDPOINT = "/cgi-bin/quecmanager/auth/check.sh";

// =============================================================================
// RebootingState — shown after a deliberate reboot until device responds
// =============================================================================

function RebootingState({ onReady }: { onReady: () => void }) {
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      // Give the device a few seconds to start going down before we begin
      await new Promise((r) => setTimeout(r, 8000));

      while (!cancelled) {
        try {
          const r = await fetch(CHECK_ENDPOINT);
          if (!cancelled && r.ok) {
            onReadyRef.current();
            return;
          }
        } catch {
          // Still offline — keep waiting
        }
        await new Promise((r) => setTimeout(r, 5000));
      }
    };

    poll();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <motion.div
      className="flex flex-col items-center gap-6 py-8 text-center"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      {/* Pulsing rings */}
      <div className="relative flex size-20 items-center justify-center">
        <div className="absolute size-20 rounded-full bg-primary/10 animate-pulse-ring" />
        <div
          className="absolute size-14 rounded-full bg-primary/20 animate-pulse-ring"
          style={{ animationDelay: "0.3s" }}
        />
        <div
          className="absolute size-9 rounded-full bg-primary/30 animate-pulse-ring"
          style={{ animationDelay: "0.6s" }}
        />
        <div className="relative size-5 rounded-full bg-primary" />
      </div>

      <div className="flex flex-col gap-1.5">
        <h2 className="text-lg font-semibold">Device is rebooting</h2>
        <p className="text-sm text-muted-foreground max-w-[260px]">
          This usually takes 30–60 seconds. You'll be prompted to log in once
          it's back online.
        </p>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Spinner className="size-3" />
        Waiting for device…
      </div>
    </motion.div>
  );
}

// =============================================================================
// LoginComponent
// =============================================================================

export default function LoginComponent() {
  const { status, login } = useLogin();

  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [retryAfter, setRetryAfter] = useState(0);

  // Detect URL params without useSearchParams (avoids Suspense requirement)
  const [isRebooting, setIsRebooting] = useState(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("rebooting") === "1";
  });
  const wasOffline =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("reason") === "offline";

  // Redirect to dedicated onboarding wizard when this is a fresh install
  useEffect(() => {
    if (status === "setup_required") {
      window.location.href = "/setup/";
    }
  }, [status]);

  // Rate limit countdown timer
  useEffect(() => {
    if (retryAfter <= 0) return;
    const id = setInterval(() => {
      setRetryAfter((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [retryAfter]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      setIsSubmitting(true);
      try {
        const result = await login(password);
        if (!result.success) {
          if (result.retry_after) {
            setRetryAfter(result.retry_after);
            setError(
              `Too many failed attempts. Try again in ${result.retry_after} seconds.`
            );
          } else {
            setError(result.error || "Invalid password.");
          }
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [password, login]
  );

  // Show spinner while detecting setup status or during redirect to /setup/
  if (status === "loading" || status === "setup_required") {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <Spinner className="size-6" />
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      {isRebooting ? (
        <RebootingState key="rebooting" onReady={() => setIsRebooting(false)} />
      ) : (
        <motion.div
          key="login"
          className="flex flex-col gap-6"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          {/* Offline session-loss banner */}
          {wasOffline && (
            <div className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
              Your session ended because the device was unreachable for too long.
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="flex size-16 p-1 items-center justify-center rounded-md">
                  <img
                    src="/qmanager-logo.svg"
                    alt="QManager Logo"
                    className="size-full"
                  />
                </div>
                <h1 className="text-xl font-bold">Welcome to QManager</h1>
                <FieldDescription>
                  Enter your QManager password to continue.
                </FieldDescription>
              </div>

              <Field>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isSubmitting}
                />
              </Field>

              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}

              <Field>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting || retryAfter > 0}
                >
                  {isSubmitting ? (
                    <>
                      <Spinner className="mr-2" />
                      Logging in...
                    </>
                  ) : retryAfter > 0 ? (
                    `Locked (${retryAfter}s)`
                  ) : (
                    "Login"
                  )}
                </Button>
              </Field>
            </FieldGroup>
          </form>
          <FieldDescription className="px-6 text-center">
            QManager — Quectel Modem Management
          </FieldDescription>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
