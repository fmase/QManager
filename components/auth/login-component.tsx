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
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { ModeToggle } from "@/components/public/mode-toggle";
import { LoginLanguagePicker } from "@/components/auth/login-language-picker";
import { resolveErrorMessage } from "@/lib/i18n/resolve-error";

// =============================================================================
// LoginComponent
// =============================================================================
// Wraps the login form in the same Card chrome as components/public/overview-card.tsx
// so /login feels like /` continuing into focus mode rather than a separate
// page. Logo + product CardTitle in the header, language + theme cluster in
// CardAction (replaces the previous fixed top-right picker), device-first
// hostname heading in the body, copyright in CardFooter.
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

  // Fresh-install devices belong on the dedicated onboarding wizard, not the
  // password gate.
  useEffect(() => {
    if (status === "setup_required") {
      window.location.href = "/setup/";
    }
  }, [status]);

  // Rate-limit countdown timer drives the button label ("Locked (Ns)").
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
            // Static "rate_limited" copy: the live countdown lives on the
            // button label, so the error region stays still and assistive
            // tech doesn't re-announce every tick.
            setError(
              resolveErrorMessage(
                t,
                "rate_limited",
                undefined,
                "Too many failed attempts. Please try again later.",
              ),
            );
          } else {
            setError(
              resolveErrorMessage(
                t,
                result.error,
                undefined,
                "Invalid password.",
              ),
            );
          }
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [password, login, t],
  );

  const isPreparing = status === "loading" || status === "setup_required";

  return (
    <motion.div
      // DESIGN.md's signed motion curve (ease-out-quart, Apple Control Center
      // settle). useReducedMotion zeroes the duration so vestibular-sensitive
      // users see the card mount in place rather than slide.
      initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
      animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
      transition={
        shouldReduceMotion
          ? { duration: 0 }
          : { duration: 0.35, ease: [0.16, 1, 0.3, 1] }
      }
    >
      <Card className="w-full">
        <CardHeader className="items-center">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center">
              {/* Decorative — adjacent CardTitle names the product for AT. */}
              <img
                src="/qmanager-logo.svg"
                alt=""
                aria-hidden="true"
                className="size-full"
              />
            </div>
            <CardTitle as="h1" className="text-base">
              {t("overview.title")}
            </CardTitle>
          </div>

          {/* Action cluster mirrors the Overview's LuCI + ModeToggle pair.
              LuCI is intentionally omitted from /login: diagnostics live on
              the unauthenticated Overview; the gate stays focused on the one
              action a user is here to perform. */}
          <CardAction className="flex items-center gap-1.5">
            <LoginLanguagePicker variant="outline" size="icon-touch" />
            <ModeToggle />
          </CardAction>
        </CardHeader>

        <CardContent>
          {isPreparing ? (
            <div
              role="status"
              aria-live="polite"
              className="text-muted-foreground flex flex-col items-center gap-3 py-12 text-sm"
            >
              <Spinner className="size-6" />
              <span>{t("state.loading")}</span>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {/* Both banners share one shape: rounded-lg + tinted border +
                  tinted bg + leading icon + tinted text. The role is carried
                  by color + icon (warning ⇆ destructive) per DESIGN.md §5. */}
              {wasOffline && (
                <div className="border-warning/30 bg-warning/10 text-warning flex items-start gap-2 rounded-lg border px-4 py-3 text-sm">
                  <TriangleAlertIcon
                    aria-hidden
                    className="size-4 shrink-0 translate-y-px"
                  />
                  <span>{t("login.session_expired")}</span>
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <FieldGroup>
                  {/* Device-first heading per the established Linear-workspace-
                      login IA: hostname is the user's mental anchor ("I'm
                      signing into this router"). The CardTitle above already
                      names the product, so the previous "QManager" eyebrow
                      under the hostname is now redundant and removed. When
                      hostname is missing (older firmware, empty value) we
                      drop the heading entirely rather than repeat the product
                      name — the password label carries enough context on its
                      own. */}
                  {(isHostnameLoading || hostname) && (
                    <div className="flex flex-col items-center text-center">
                      {isHostnameLoading ? (
                        <Skeleton
                          aria-label={t("login.loading_hostname")}
                          className="h-8 w-[14rem] rounded-md"
                        />
                      ) : (
                        <h2
                          className="text-foreground max-w-full truncate text-3xl font-semibold tracking-[-0.015em] [font-variant-numeric:tabular-nums]"
                          title={hostname ?? undefined}
                        >
                          {hostname}
                        </h2>
                      )}
                    </div>
                  )}

                  <Field>
                    <FieldLabel htmlFor="password">
                      {t("login.password_label")}
                    </FieldLabel>
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
                        className="text-muted-foreground hover:text-foreground absolute right-1 top-1/2 -translate-y-1/2"
                        onClick={() => setShowPassword((v) => !v)}
                        tabIndex={-1}
                        aria-label={
                          showPassword
                            ? t("login.hide_password")
                            : t("login.show_password")
                        }
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
                      className="border-destructive/30 bg-destructive/10 text-destructive flex items-start gap-2 rounded-lg border px-4 py-3 text-sm"
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
            </div>
          )}
        </CardContent>

        <CardFooter className="justify-center">
          {/* Same copyright line as the Overview card. Reusing
              overview.copyright keeps both surfaces in sync if the year or
              brand string ever changes. */}
          <p className="text-muted-foreground text-xs">
            {t("overview.copyright", { year: new Date().getFullYear() })}
          </p>
        </CardFooter>
      </Card>
    </motion.div>
  );
}
