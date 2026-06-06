"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useTranslation } from "react-i18next";

import { useDeviceHostname } from "@/hooks/use-device-hostname";
import { Skeleton } from "@/components/ui/skeleton";

// =============================================================================
// LoginDeviceName — pre-auth device-identity line for the login title block.
// =============================================================================
// Answers "which modem am I signing into?" with a quiet muted-text line under
// the headline. It is NOT an action, so it stays in muted ink with no accent,
// no border, no chrome — context, not a control. The lighter-weight pill
// treatment was dropped in favour of plain muted text per the product owner.
//
// Self-contained by design: it owns the hostname fetch and all three states so
// LoginComponent only has to drop it in. The hook's contract is silent
// omission (older firmware without the CGI, or an unnamed device → `null`), so
// the absent state renders nothing and the title block closes up around it.
//
// Type identity, not the AT terminal: per DESIGN.md's Machine-Voice Rule, the
// hostname stays in Manrope. JetBrains Mono is scoped strictly to the AT
// terminal and raw AT output; a device name on the login screen is not that.
// =============================================================================

export function LoginDeviceName() {
  const { t } = useTranslation("common");
  const { hostname, isLoading } = useDeviceHostname();
  const shouldReduceMotion = useReducedMotion();

  const transition = shouldReduceMotion
    ? { duration: 0 }
    : { duration: 0.3, ease: [0.16, 1, 0.3, 1] as const };

  return (
    // mode="wait" so the skeleton fades fully out before the resolved name (or
    // nothing) fades in — no cross-fade overlap, and the absent case reflows
    // the column gracefully instead of the line vanishing mid-frame.
    <AnimatePresence mode="wait" initial={false}>
      {isLoading ? (
        <motion.div
          key="loading"
          initial={shouldReduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={transition}
        >
          <Skeleton className="h-4 w-36 rounded-sm" />
        </motion.div>
      ) : hostname ? (
        <motion.p
          key="hostname"
          initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={transition}
          className="text-muted-foreground min-w-0 max-w-full truncate text-sm font-medium tracking-tight"
        >
          {/* Screen readers get the whole sentence once; the visible name is
              hidden from the a11y tree so the hostname isn't announced as a
              bare, context-free token. */}
          <span className="sr-only">
            {t("login.signing_in_to", { hostname })}
          </span>
          <span aria-hidden>{hostname}</span>
        </motion.p>
      ) : null}
    </AnimatePresence>
  );
}
