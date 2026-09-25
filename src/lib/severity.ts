import type { ViolationClass } from "./nyc/types";

/**
 * Renters do not know what a Class C violation is, so the label travels with
 * the class everywhere it appears. Never render a bare "Class C".
 */
export const CLASS_INFO: Record<
  ViolationClass,
  { label: string; blurb: string; accent: string; soft: string; text: string }
> = {
  C: {
    label: "Immediately hazardous",
    blurb:
      "Class C covers conditions HPD considers an immediate danger, such as no heat in winter, lead paint, or a pest infestation. Landlords must fix them within 24 hours.",
    accent: "bg-sev-c",
    soft: "bg-sev-c-soft",
    text: "text-sev-c",
  },
  B: {
    label: "Hazardous",
    blurb:
      "Class B covers hazardous conditions such as leaks, mold, or broken plumbing. Landlords have 30 days to fix them.",
    accent: "bg-sev-b",
    soft: "bg-sev-b-soft",
    text: "text-sev-b",
  },
  A: {
    label: "Non-hazardous",
    blurb:
      "Class A covers non-hazardous problems such as chipped paint or a missing sign. Landlords have 90 days to fix them.",
    accent: "bg-sev-a",
    soft: "bg-sev-a-soft",
    text: "text-sev-a",
  },
  I: {
    label: "Informational",
    blurb: "An informational order rather than a hazard finding.",
    accent: "bg-sev-a",
    soft: "bg-sev-a-soft",
    text: "text-sev-a",
  },
};
