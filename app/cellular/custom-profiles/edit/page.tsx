"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// =============================================================================
// /cellular/custom-profiles/edit — redirect shim
// =============================================================================
// The edit flow is now handled in-place on the main Custom Profiles page via
// the ?compose=<id> URL param. This shim reads ?id= and redirects to the new
// URL so legacy deep-links and any outstanding navigation entries keep working.
// =============================================================================

function EditRedirectInner() {
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get("id");

  useEffect(() => {
    if (id) {
      router.replace(
        `/cellular/custom-profiles/?compose=${encodeURIComponent(id)}`,
      );
    } else {
      router.replace("/cellular/custom-profiles/");
    }
  }, [router, id]);

  return null;
}

export default function EditProfileRedirect() {
  return (
    <Suspense fallback={null}>
      <EditRedirectInner />
    </Suspense>
  );
}
