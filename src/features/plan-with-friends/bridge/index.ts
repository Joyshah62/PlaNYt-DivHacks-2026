// The only way this feature reaches the rest of Roam. If app internals move, fix them here.
export type { DayPlan, PlanRequest, Profile, StopInput } from "@/lib/plan/types";
export { DEFAULT_PROFILE, isMealBreak } from "@/lib/plan/profile";
export { PlanRequestSchema, StopSchema } from "@/lib/plan/schema";
export { decodePlan, encodePlan, parseProfile, readProfileRaw, storeProfile } from "@/lib/plan/share";
export { clock, duration, nycNowMin, nycToday, WEEKDAYS, weekdayOf } from "@/lib/plan/time";
export { BRAND, CROWD_COLOR, CROWD_LABEL, LEG_VERB } from "@/lib/plan/display";
export { inNycArea } from "@/lib/osm/geo";
export { ATTRACTIONS, type Attraction } from "@/lib/plan/attractions";
export { CATEGORIES, CATEGORY } from "@/lib/discover/categories";
export { parseOsmHours } from "@/lib/discover/hours";
export { crowdBand, crowdProfile, nearestStations, STATIONS } from "@/lib/plan/crowd";
export { subwayLeg } from "@/lib/plan/travel";
export type { AssistantResult } from "@/lib/plan/types";

/** App endpoints this feature calls over HTTP. If the app moves one, change it here. */
export const APP_API = { plan: "/api/plan", resolve: "/api/resolve", photo: "/api/photo", assistant: "/api/assistant" } as const;
