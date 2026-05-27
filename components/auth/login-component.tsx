"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "motion/react";
import {
  EyeIcon,
  EyeOffIcon,
  TriangleAlertIcon,
  XCircleIcon,
} from "lucide-react";
import { useLogin } from "@/hooks/use-auth";
import { useDeviceHostname } from "@/hooks/use-device-hostname";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { resolveErrorMessage } from "@/lib/i18n/resolve-error";

// =============================================================================
// LoginComponent
// =============================================================================

export default function LoginComponent() {
  const { t } = useTranslation("common");
  const { status, login } = useLogin();
  const { hostname, isLoading: isHostnameLoading } = useDeviceHostname();
  const shouldReduceMotion = useReducedMotion();

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [retryAfter, setRetryAfter] = useState(0);

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
            // Route through i18n; the button label carries the live
            // countdown (`Locked (${n}s)`), so the error text stays static.
            // Dynamic seconds in a role="alert" region would re-announce on
            // every tick to assertive screen readers. The static phrasing
            // also matches the "rate_limited" key already in errors.json.
            setError(
              resolveErrorMessage(
                t,
                "rate_limited",
                undefined,
                "Too many failed attempts. Please try again later.",
              ),
            );
          } else {
            setError(resolveErrorMessage(t, result.error, undefined, "Invalid password."));
          }
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [password, login, t],
  );

  // Show spinner while detecting setup status or during redirect to /setup/.
  // The labeled state is for screen reader users (and for the small but real
  // window where a slow modem keeps this state visible long enough to notice).
  if (status === "loading" || status === "setup_required") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex flex-col items-center gap-3 py-12 text-sm text-muted-foreground"
      >
        <Spinner className="size-6" />
        <span>{t("state.loading")}</span>
      </div>
    );
  }

  return (
    <motion.div
      className="flex flex-col gap-6"
      // initial={false} mounts at the final state with no transition fired
      // at all (Framer Motion idiom). Cleaner than zeroing duration; respects
      // prefers-reduced-motion as the design system's accessibility floor
      // demands. The curve below is DESIGN.md's codified ease-out-quart
      // (cubic-bezier(0.16, 1, 0.3, 1)), the Apple Control Center settle.
      initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
      {/*
        Both banners (offline notice, auth error) follow the same shape:
        rounded-lg + tinted border + tinted bg + leading icon + tinted text.
        Single source of pattern, distinguished by color role (warning vs
        destructive) and icon (TriangleAlert vs XCircle) per DESIGN.md §5.
      */}
      {wasOffline && (
        <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          <TriangleAlertIcon
            aria-hidden
            className="size-4 shrink-0 translate-y-px"
          />
          <span>{t("login.session_expired")}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <FieldGroup>
          {/*
            Heading group is now device-first per the IA inversion: hostname
            takes the Display slot, QManager demotes to a small label below.
            Linear-workspace-login pattern. When hostname is loading we render
            a skeleton sized to the typical hostname width; when it's absent
            (older firmware, empty value) we fall back to "QManager" as the
            heading and hide the brand label to avoid repeating the word.
          */}
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="flex size-10 items-center justify-center rounded-md">
              <img
                src="/qmanager-logo.svg"
                alt={t("login.logo_alt")}
                className="size-full"
              />
            </div>
            <div className="flex max-w-full flex-col items-center gap-1">
              {isHostnameLoading ? (
                <Skeleton
                  aria-label={t("login.loading_hostname")}
                  className="h-8 w-[14rem] rounded-md"
                />
              ) : (
                <h1
                  className="max-w-full truncate text-3xl font-semibold tracking-[-0.015em] text-foreground [font-variant-numeric:tabular-nums]"
                  title={hostname ?? undefined}
                >
                  {hostname ?? "QManager"}
                </h1>
              )}
              {(isHostnameLoading || hostname) && (
                <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                  {t("login.brand_label")}
                </p>
              )}
            </div>
          </div>

          <Field>
            <FieldLabel htmlFor="password">{t("login.password_label")}</FieldLabel>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isSubmitting}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                aria-label={showPassword ? t("login.hide_password") : t("login.show_password")}
              >
                {showPassword ? (
                  <EyeOffIcon className="size-4" />
                ) : (
                  <EyeIcon className="size-4" />
                )}
              </Button>
            </div>
          </Field>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              <XCircleIcon
                aria-hidden
                className="size-4 shrink-0 translate-y-px"
              />
              <span>{error}</span>
            </div>
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
                  {t("login.signing_in")}
                </>
              ) : retryAfter > 0 ? (
                t("login.locked", { seconds: retryAfter })
              ) : (
                t("login.submit")
              )}
            </Button>
          </Field>
        </FieldGroup>
      </form>
    </motion.div>
  );
}
