import type { StopInput } from "../bridge/index";

/** One place to offer the group, as the SuggestionCarousel shows it. */
export interface SuggestionItem {
  key: string;
  name: string;
  /** Neighborhood or street, never a member's location. */
  area: string | null;
  category: string;
  /** e.g. "Usually quiet around 3pm". */
  crowdHint: string | null;
  /** Why it was suggested, when Gemini said. */
  why: string | null;
  stop: StopInput;
}
