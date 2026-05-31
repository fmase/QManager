"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// =============================================================================
// /cellular/custom-profiles/new — redirect shim
// =============================================================================
// The create flow is now handled in-place on the main Custom Profiles page via
// the ?compose=new URL param. This shim redirects legacy deep-links so no
// existing bookmark or navigation entry breaks.
// =============================================================================

export default function NewProfileRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/cellular/custom-profiles/?compose=new");
  }, [router]);

  return null;
}
