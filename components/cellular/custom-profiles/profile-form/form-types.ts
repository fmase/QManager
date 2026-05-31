import type { ProfileFormData } from "@/hooks/use-sim-profiles";

// =============================================================================
// form-types — shared contract for the single-page profile editor
// =============================================================================
// The editor (profile-editor.tsx) owns all form state; the grouped field cards
// are presentational and receive this generic setter. Kept in its own module so
// cards and the editor can both import the type without a runtime import cycle.
// =============================================================================

/** Generic field setter shared across the editor's grouped cards. */
export type UpdateField = <K extends keyof ProfileFormData>(
  key: K,
  value: ProfileFormData[K],
) => void;
