import type { Variants } from "motion/react";

/**
 * Stagger container — staggers children at 0.06s intervals.
 * Used with `fadeUpItem` for card content entrance animations.
 */
export const containerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

/**
 * Fade-up entrance — fades in from 8px below.
 * Pair with `containerVariants` on the parent for staggered reveals.
 */
export const itemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
};
