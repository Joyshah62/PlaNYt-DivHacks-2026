import { ATTRACTION_BY_ID } from "./attractions";
import { GROUP, groupPeople, visitFor } from "./profile";
import type { AssistantResult, Choice, PlanRequest, Profile, StopInput } from "./types";

/** Everything about a day except its stops and the traveler: what the planner's form holds. */
export interface PlanSettings extends Omit<PlanRequest, "stops" | "profile" | "keepOrder"> {
  /** Keep the stops in their listed order (after placing something found by discovery). */
  keepOrder: boolean;
}

/** A new day: 9 to 9 on the subway, avoiding crowds, with lunch. */
export function defaultSettings(date: string): PlanSettings {
  return {
    date,
    startMin: 9 * 60,
    endMin: 21 * 60,
    mode: "transit",
    crowd: "avoid",
    origin: null,
    returnToOrigin: false,
    meals: { lunch: true, dinner: false },
    keepOrder: false,
  };
}

/**
 * What the assistant read from a request, laid over the current form: named
 * settings replace the old ones, a group brings its walking limit, and catalog
 * stops at their typical length take the traveler's pace.
 */
export function fromAssistant(
  r: AssistantResult,
  current: PlanSettings,
  profile: Profile,
): { settings: PlanSettings; profile: Profile; profileChanged: boolean; stops: StopInput[]; choices: Choice[] } {
  const settings: PlanSettings = {
    ...current,
    date: r.date ?? current.date,
    startMin: r.startMin ?? current.startMin,
    endMin: r.endMin && r.endMin > (r.startMin ?? current.startMin) ? r.endMin : current.endMin,
    mode: r.mode ?? current.mode,
    crowd: r.crowd ?? current.crowd,
    origin: r.origin ?? current.origin,
    meals: { ...current.meals, ...r.meals },
    keepOrder: false,
  };
  // A group named in the text brings its walking limit unless the text set one.
  const groupWalk = r.profile.group && r.profile.walkMax === undefined ? { walkMax: GROUP[r.profile.group].walkMax } : {};
  // Each day has its own party: what this request says, else what the group means
  // (one, two, or unknown). A count from another trip never carries over.
  const next: Profile = { ...profile, ...r.profile, ...groupWalk, group: r.profile.group ?? "unspecified", people: r.profile.people ?? groupPeople(r.profile.group ?? "unspecified") };
  if (next.people === undefined) delete next.people;
  const pace = <T extends StopInput>(s: T): T => {
    const a = s.attractionId ? ATTRACTION_BY_ID.get(s.attractionId) : undefined;
    return a && s.visitMin === a.visitMin ? { ...s, visitMin: visitFor(a, next.pace) } : s;
  };
  return {
    settings,
    profile: next,
    profileChanged: Object.keys(r.profile).length > 0 || next.people !== profile.people || next.group !== profile.group,
    stops: r.stops.map(pace),
    choices: (r.choices ?? []).map((c) => ({ ...c, options: c.options.map(pace) })),
  };
}

/** The request /api/plan takes, from the form's parts. */
export function toRequest(stops: StopInput[], settings: PlanSettings, profile: Profile): PlanRequest {
  return { ...settings, stops, returnToOrigin: settings.origin ? settings.returnToOrigin : false, profile };
}
