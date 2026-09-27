"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { ArrowLeft, ArrowRight, ChevronUp, Clock, Loader2, MapPin, RefreshCw, Trash2, X } from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { AccountMenu, type Account } from "@/components/auth/AccountMenu";
import { haversine } from "@/lib/osm/geo";
import { ATTRACTION_BY_ID, ATTRACTIONS, type Attraction } from "@/lib/plan/attractions";
import { fillSlot } from "@/lib/plan/choices";
import { planToIcs } from "@/lib/plan/ics";
import { catalogPhoto } from "@/lib/plan/photoUrls";
import { nextStep } from "@/lib/plan/live";
import { buildTimeline } from "@/lib/plan/playback";
import type { Forecast } from "@/lib/plan/weatherCodes";
import { BRAND } from "@/lib/plan/display";
import { DEFAULT_PROFILE, GROUP, isMealBreak, MEAL_WINDOW, partySize, suggestFor, visitFor } from "@/lib/plan/profile";
import {
  decodePlan,
  encodePlan,
  parseProfile,
  parseSaved,
  readProfileRaw,
  readSavedRaw,
  storeProfile,
  storeSaved,
  subscribeProfile,
  subscribeSaved,
  type SavedPlan,
} from "@/lib/plan/share";
import { clock, duration, nycToday, toHHMM, toMinutes, weekdayOf, WEEKDAYS } from "@/lib/plan/time";
import type {
  AssistantResult,
  Choice,
  ChoiceOption,
  CrowdPref,
  DayPlan,
  MealKind,
  Meals,
  PlanRequest,
  PlannedStop,
  PointLabel,
  Profile,
  StopInput,
  TravelMode,
} from "@/lib/plan/types";
import { withAnswers, type FollowUp } from "@/lib/plan/followUps";
import { ChoicePanel } from "./ChoicePanel";
import { useDiscover } from "./Discover";
import { TripChat } from "./TripChat";
import { Assistant, type AssistantHandle } from "./Assistant";
import { arrowKeys } from "./arrowKeys";
import { Fold } from "./Fold";
import { FollowUpQuestions } from "./FollowUpQuestions";
import { NextUp, nextLine, useNycNow } from "./NextUp";
import { DayPicker } from "./DayPicker";
import { Itinerary } from "./Itinerary";
import { Budget } from "./Budget";
import { PhoneSend } from "./PhoneSend";
import { GroupTrips } from "./GroupTrips";
import { PlaceSheet, type InspectPlace } from "./PlaceSheet";
import { ReplanDialog, type ReplanChoice } from "./ReplanDialog";
import type { MapLeg, MapStop } from "./PlanMap";
import { StopPicker, stopFromAttraction } from "./StopPicker";

const PlanMap = dynamic(() => import("./PlanMap").then((m) => m.PlanMap), {
  ssr: false,
  loading: () => <div className="pl-skeleton size-full" />,
});

const MAX_STOPS = 10;
const VISIT_OPTIONS = [15, 30, 45, 60, 75, 90, 120, 150, 180, 240];
/** Days to start from: a photo (a catalog place in the day), a line about it, and the prompt it fills in. */
/** Who an idea is for; the filter over the list. */
type Party = "solo" | "couple" | "friends" | "kids" | "seniors";
const PARTY_LABEL: Record<Party, string> = { solo: "Solo", couple: "Couple", friends: "With friends", kids: "With kids", seniors: "Older parents" };

/**
 * Ideas to start from. Each names a day and who's coming, so it plans without follow-up
 * questions, and a theme includes the places that theme is known for (checked against
 * location guides), with somewhere to eat nearby and a pace that suits the party.
 */
const TRIP_STARTERS: { label: string; blurb: string; photo: string; who: Party; prompt: string }[] = [
  { who: "solo", label: "First time in NYC", blurb: "Times Square, the Empire State, the Bridge, a classic slice", photo: "empire-state", prompt: "Just me, first time in NYC this Saturday: Times Square, the Empire State Building, the 9/11 Memorial, the Brooklyn Bridge walk, lunch in Chinatown, a slice at Joe's Pizza, and the Staten Island Ferry past the Statue of Liberty. Subway and walking, avoid the biggest crowds." },
  { who: "solo", label: "Art and the High Line", blurb: "MoMA, Chelsea Market, the High Line, the Whitney", photo: "high-line", prompt: "Solo on Sunday: MoMA in the morning, lunch at Chelsea Market, walk the High Line from Hudson Yards and the Vessel down to the Whitney Museum, Little Island at sunset, then dinner in the West Village. Happy to walk." },
  { who: "solo", label: "Downtown history", blurb: "Wall Street, Federal Hall, the Memorial, the ferry", photo: "wall-street", prompt: "By myself on Friday: Wall Street with the Charging Bull and Fearless Girl, Federal Hall, Trinity Church, the 9/11 Memorial & Museum, the Oculus, lunch on Stone Street, and the Staten Island Ferry for the skyline." },
  { who: "couple", label: "Date day in DUMBO", blurb: "The Bridge, the photo spot, Jane's Carousel, sunset", photo: "dumbo", prompt: "A date day with my partner on Saturday: walk the Brooklyn Bridge, the DUMBO photo spot on Washington Street at Front Street, Jane's Carousel, the Time Out Market rooftop, Pebble Beach in Brooklyn Bridge Park, the Brooklyn Heights Promenade at sunset, and dinner at Juliana's Pizza." },
  { who: "couple", label: "Village evening", blurb: "Washington Square, Stonewall, Little Island, Bleecker", photo: "washington-square", prompt: "My partner and I, Sunday afternoon into the evening: Washington Square Park and its arch, the Stonewall National Monument, a stroll down Bleecker Street, Little Island at golden hour, and dinner in the West Village." },
  { who: "couple", label: "Midtown skyline", blurb: "Top of the Rock, the Library, Grand Central, oysters", photo: "top-of-the-rock", prompt: "My wife and I on Friday: Top of the Rock, St. Patrick's Cathedral, the Rose Main Reading Room at the New York Public Library, Bryant Park, the Whispering Gallery at Grand Central Terminal, and dinner at the Grand Central Oyster Bar. Avoid crowds." },
  { who: "couple", label: "Harlem soul and jazz", blurb: "The Apollo, Sylvia's, Red Rooster, Minton's", photo: "harlem", prompt: "My partner and I on Friday in Harlem: the Apollo Theater, a late lunch at Sylvia's on Malcolm X Boulevard, a walk past the brownstones of Strivers' Row, dinner at Red Rooster, and live jazz at Minton's Playhouse." },
  { who: "couple", label: "The 'Seinfeld' day", blurb: "Tom's Restaurant, the Soup Man, the Comedy Cellar", photo: "central-park", prompt: "My partner and I on Saturday, a Seinfeld day: breakfast at Tom's Restaurant (Monk's Café) at Broadway and 112th, a Central Park stroll, soup at The Original SoupMan on West 55th Street (the Soup Nazi), and a stand-up show at the Comedy Cellar in Greenwich Village." },
  { who: "friends", label: "The 'Friends' day", blurb: "The apartment, Central Perk, Ross's museum, the fountain", photo: "west-village", prompt: "My friends and I, four of us, on Saturday, a Friends day: the Friends apartment building at 90 Bedford Street, The FRIENDS Experience and its Central Perk on East 23rd Street, the Natural History Museum where Ross worked, and the Cherry Hill Fountain in Central Park, the look-alike of the opening-credits fountain. Dinner in the West Village." },
  { who: "friends", label: "The 'HIMYM' night", blurb: "The real MacLaren's, the Empire State, a burger", photo: "empire-state", prompt: "My friends and I, five of us, on Friday, a How I Met Your Mother day: the Empire State Building, a walk through Central Park, a burger at Corner Bistro in the West Village, and the evening at McGee's Pub on West 55th Street, the bar that inspired MacLaren's." },
  { who: "friends", label: "Lower East Side food crawl", blurb: "Katz's, Russ & Daughters, knishes, Essex Market", photo: "katz", prompt: "My friends and I, three of us, on Sunday, a Lower East Side food crawl: Katz's Delicatessen, Russ & Daughters, Yonah Schimmel Knish Bakery, Economy Candy, Essex Market, the Tenement Museum, and dumplings in Chinatown." },
  { who: "kids", label: "Dinosaurs and the park", blurb: "Natural History, playgrounds, Belvedere Castle", photo: "amnh", prompt: "Saturday with our kids, 6 and 9: the Natural History Museum (dinosaurs, the blue whale), lunch nearby, the Diana Ross Playground in Central Park, Belvedere Castle and the Bethesda Terrace. Relaxed pace, short walks." },
  { who: "kids", label: "Ships and the harbor", blurb: "The Intrepid, the shuttle, the Staten Island Ferry", photo: "intrepid", prompt: "Family day on Sunday with our kids: the Intrepid Museum and the space shuttle Enterprise, lunch in Hell's Kitchen, the Staten Island Ferry past the Statue of Liberty, and pizza for dinner. Keep walking short." },
  { who: "kids", label: "Beach day at Coney Island", blurb: "The Aquarium, Luna Park, the Wonder Wheel, Nathan's", photo: "coney-island", prompt: "A Saturday at Coney Island with my kids: the New York Aquarium, the beach and boardwalk, lunch at Nathan's Famous, Luna Park and Deno's Wonder Wheel. Subway there and back." },
  { who: "kids", label: "A rainy day with kids", blurb: "Dinosaurs, the planetarium, the Temple of Dendur", photo: "met", prompt: "It might rain on Sunday. With our children: the Natural History Museum and its planetarium, lunch indoors, then the Met's Temple of Dendur and the arms and armor galleries. As little walking outside as possible." },
  { who: "seniors", label: "Museum Mile, gently", blurb: "The Met, the Neue Galerie, Café Sabarsky, the Guggenheim", photo: "guggenheim", prompt: "With my elderly parents on Thursday: the Met, lunch at Café Sabarsky in the Neue Galerie, the Guggenheim, and a short stroll in Central Park. Slow pace, lots of rests, taxis for longer hops." },
  { who: "seniors", label: "Harbor views, easy walking", blurb: "Liberty and Ellis Island, the Battery, Fraunces Tavern", photo: "statue-of-liberty", prompt: "Taking my grandparents out on Saturday: the Statue of Liberty and Ellis Island ferry, the Battery, lunch at Fraunces Tavern, and the 9/11 Memorial pools. Minimal walking, avoid crowds." },
  { who: "seniors", label: "Grand Central and the Library", blurb: "The concourse, the Oyster Bar, the Reading Room, the Morgan", photo: "grand-central", prompt: "My older parents and I on Tuesday: Grand Central Terminal's main concourse, lunch at the Grand Central Oyster Bar, the Rose Main Reading Room at the New York Public Library, Bryant Park, and the Morgan Library. Short walks only." },
];


const ROUTE_PROFILE = { walk: "foot", bike: "bike", car: "car" } as const;

interface KeyedLeg extends MapLeg {
  /** The stop this leg arrives at, or "return". */
  key: string;
}

/** What the map draws before (or instead of) routed geometry: straight hops, subway via its stations. */
function straightLegs(plan: DayPlan): KeyedLeg[] {
  const out: KeyedLeg[] = [];
  let prev: { lat: number; lon: number } | null = plan.request.origin;
  const add = (key: string, to: { lat: number; lon: number }, leg: DayPlan["stops"][number]["leg"]) => {
    if (prev && leg) {
      const via = leg.board && leg.alight ? [leg.board, leg.alight] : [];
      out.push({ key, mode: leg.mode, coordinates: [prev, ...via, to].map((p) => [p.lon, p.lat]) });
    }
    prev = to;
  };
  for (const s of plan.stops) add(s.key, s, s.leg);
  if (plan.returnLeg && plan.request.origin) add("return", plan.request.origin, plan.returnLeg);
  return out;
}

/** Street-following geometry for walk, bike and car legs; subway legs stay station to station. */
async function routedLegs(plan: DayPlan): Promise<KeyedLeg[]> {
  return Promise.all(
    straightLegs(plan).map(async (leg) => {
      if (leg.mode === "subway") return leg;
      const [from, to] = [leg.coordinates[0], leg.coordinates[leg.coordinates.length - 1]];
      try {
        const res = await fetch(`/api/route?from=${from[1]},${from[0]}&to=${to[1]},${to[0]}&mode=${ROUTE_PROFILE[leg.mode]}`);
        if (!res.ok) return leg;
        const body = (await res.json()) as { coordinates: [number, number][] };
        return { ...leg, coordinates: body.coordinates };
      } catch {
        return leg;
      }
    }),
  );
}

/** A name for a saved plan: "Sat, Sep 26 · The Met, MoMA +2". */
function planTitle(r: PlanRequest): string {
  const day = new Date(`${r.date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  const names = r.stops.map((s) => s.name);
  return `${day} · ${names.slice(0, 2).join(", ")}${names.length > 2 ? ` +${names.length - 2}` : ""}`;
}

/** Meal options are looked up again once the meal moves this far (the day was re-planned). */
const MEAL_ANCHOR_METERS = 700;
const MEALS: MealKind[] = ["lunch", "dinner"];
const mealChoiceId = (kind: MealKind) => `meal-${kind}`;
const mealSpotKey = (kind: MealKind, p: { lat: number; lon: number }) => `${kind}@${p.lat.toFixed(3)},${p.lon.toFixed(3)}`;

/** A meal break in the plan that has no options around it yet. */
function mealsNeedingOptions(plan: DayPlan, choices: Choice[], noFood: Set<string>): { kind: MealKind; stop: PlannedStop }[] {
  return MEALS.flatMap((kind) => {
    const stop = plan.stops.find((s) => s.meal === kind);
    if (!stop || !isMealBreak(stop) || noFood.has(mealSpotKey(kind, stop))) return [];
    const group = choices.find((c) => c.id === mealChoiceId(kind));
    return group?.anchor && haversine(group.anchor, stop) < MEAL_ANCHOR_METERS ? [] : [{ kind, stop }];
  });
}

/** The choices that still apply to this plan: wishes whose stop is in it, meals that happen in it. */
function choicesFor(plan: DayPlan, choices: Choice[]): Choice[] {
  return choices
    .filter((c) => {
      if (c.kind === "wish") return plan.request.stops.some((s) => s.key === c.currentKey);
      const stop = plan.stops.find((s) => s.meal === c.meal);
      if (!stop) return false;
      if (c.currentKey) return stop.key === c.currentKey;
      return isMealBreak(stop) && !!c.anchor && haversine(c.anchor, stop) < MEAL_ANCHOR_METERS;
    })
    .sort((a, b) => (a.kind === b.kind ? MEALS.indexOf(a.meal!) - MEALS.indexOf(b.meal!) : a.kind === "wish" ? -1 : 1));
}

/** Discovery works on a planned day, shown as the itinerary. */
const showingPlanForDiscover = (plan: DayPlan | null, view: "edit" | "plan") => (view === "plan" ? plan : null);

/** Phones and small tablets get the map full screen with the panel as a bottom sheet. */
const PHONE_QUERY = "(max-width: 1023px)";
function subscribePhone(onChange: () => void) {
  const mq = window.matchMedia(PHONE_QUERY);
  mq.addEventListener("change", onChange);
  window.addEventListener("resize", onChange);
  window.visualViewport?.addEventListener("resize", onChange);
  return () => {
    mq.removeEventListener("change", onChange);
    window.removeEventListener("resize", onChange);
    window.visualViewport?.removeEventListener("resize", onChange);
  };
}
type SheetSnap = "peek" | "half" | "full";
const SHEET_PEEK = 150;

interface Settings {
  date: string;
  startMin: number;
  endMin: number;
  mode: TravelMode;
  crowd: CrowdPref;
  origin: PointLabel | null;
  returnToOrigin: boolean;
  meals: Meals;
  /** Keep the stops in their listed order (after placing something found by discovery). */
  keepOrder: boolean;
}


/** One sentence for a screen reader when a day lands. */
function dayAnnouncement(p: DayPlan): string {
  const n = p.stops.filter((s) => !isMealBreak(s)).length;
  return `Your day is planned: ${n} ${n === 1 ? "stop" : "stops"}, ${clock(p.stops[0]?.startMin ?? p.request.startMin)} to ${clock(p.summary.finishMin)}, ${duration(p.summary.travelMin)} of travel.`;
}

/** The wordmark: in the planner, home is Build, where a day starts. */
function Logo({ onHome }: { onHome: () => void }) {
  return (
    <button type="button" onClick={onHome} aria-label={`${BRAND.name}: start a day`} className="ed-wordmark ed-display">
      {BRAND.name}
    </button>
  );
}

export function PlannerView({ initialPrompt, initialPlan, account }: { initialPrompt: string | null; initialPlan: string | null; account: Account }) {
  // A shared or saved plan fills the form before the first render; the effect below plans it.
  const [shared] = useState(() => (initialPlan ? decodePlan(initialPlan) : null));
  const [stops, setStops] = useState<StopInput[]>(() => shared?.stops ?? []);
  const [settings, setSettings] = useState<Settings>(() => {
    const today = nycToday();
    const base: Settings = {
      date: today,
      startMin: 9 * 60,
      endMin: 21 * 60,
      mode: "transit",
      crowd: "avoid",
      origin: null,
      returnToOrigin: false,
      meals: { lunch: true, dinner: false },
      keepOrder: false,
    };
    if (!shared) return base;
    // An old link keeps its stops and times, but a past date moves to today.
    // Only the settings fields: the shared request also carries its stops and profile, which live elsewhere.
    return {
      date: shared.date < today ? today : shared.date,
      startMin: shared.startMin,
      endMin: shared.endMin,
      mode: shared.mode,
      crowd: shared.crowd,
      origin: shared.origin,
      returnToOrigin: shared.returnToOrigin,
      meals: shared.meals,
      keepOrder: shared.keepOrder ?? false,
    };
  });
  const [plan, setPlan] = useState<DayPlan | null>(null);
  const [view, setView] = useState<"edit" | "plan">("edit");
  const [planning, setPlanning] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  // Said to screen readers when a new day lands.
  const [announce, setAnnounce] = useState("");
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [geometry, setGeometry] = useState<{ for: DayPlan | null; legs: KeyedLeg[] }>({ for: null, legs: [] });
  const [inspect, setInspect] = useState<InspectPlace | null>(null);
  /** A place from the chat, being looked at on the map. */
  const [ideaParty, setIdeaParty] = useState<Party | null>(null);
  const [peek, setPeek] = useState<{ key: string; name: string; lat: number; lon: number } | null>(null);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const savedRaw = useSyncExternalStore(subscribeSaved, readSavedRaw, () => "[]");
  const savedPlans = useMemo(() => parseSaved(savedRaw), [savedRaw]);
  // The traveler profile lives on this device; a shared link can bring its own for this visit.
  const storedProfileRaw = useSyncExternalStore(subscribeProfile, readProfileRaw, () => "");
  const [profileOverride, setProfileOverride] = useState<Profile | null>(() =>
    shared && JSON.stringify(shared.profile) !== JSON.stringify(DEFAULT_PROFILE) ? shared.profile : null,
  );
  const profile = profileOverride ?? parseProfile(storedProfileRaw) ?? DEFAULT_PROFILE;
  const profileRef = useRef(profile);
  useEffect(() => {
    profileRef.current = profile;
  });
  const [replanOpen, setReplanOpen] = useState(false);

  const [prompt, setPrompt] = useState(initialPrompt ?? "");
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const [thinking, setThinking] = useState(false);
  // What Roam AI said. Once it has built a day (`planned`), it's shown with the day, not in Build.
  const [assistant, setAssistant] = useState<{ reply: string; unresolved: string[]; planned?: boolean } | null>(null);
  const [assistantError, setAssistantError] = useState<string | null>(null);
  /** Pre-plan questions (when / who). The original prompt is kept so answers can be appended. */
  const [followUpQs, setFollowUpQs] = useState<FollowUp[] | null>(null);
  const pendingPrompt = useRef("");
  const [choices, setChoices] = useState<Choice[]>([]);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  // Photos for searched places, looked up once each; catalog photos ship with the app.
  const [placePhotos, setPlacePhotos] = useState<Record<string, string | null>>({});
  // Meal spots where no food turned up, so they are not looked up again.
  const [noFood, setNoFood] = useState<Set<string>>(() => new Set());

  // The picked places' tray at the foot of the column: collapsed to thumbnails, opened to edit.
  const [trayOpen, setTrayOpen] = useState(false);
  // Build: describe the day, or pick places. Coming back with stops lands on picking them.
  const [mode, setMode] = useState<"describe" | "pick">(() => (shared?.stops.length ? "pick" : "describe"));
  // The last stop taken out of the tray, for a few seconds, so it can be put back.
  const [removed, setRemoved] = useState<{ stop: StopInput; index: number } | null>(null);
  useEffect(() => {
    if (!removed) return;
    const id = window.setTimeout(() => setRemoved(null), 6000);
    return () => window.clearTimeout(id);
  }, [removed]);
  // The floating assistant: whether it's open, and a reply waiting while it was closed.
  const [unread, setUnread] = useState(false);
  const assistantOpen = useRef(false);
  const assistantHandle = useRef<AssistantHandle>(null);
  const onAssistantOpen = useCallback((open: boolean) => {
    assistantOpen.current = open;
    if (open) {
      setUnread(false);
      // Back in the chat: the place it was showing leaves the map.
      setPeek(null);
    }
  }, []);
  // Until the reader drags the divider, the column is a reading column: a little over a quarter of the window, 400–560px.
  const [panelWidth, setPanelWidth] = useState<number | null>(null);
  // Phone layout: the panel is a sheet over a full-screen map, dragged between three heights.
  const isPhone = useSyncExternalStore(subscribePhone, () => window.matchMedia(PHONE_QUERY).matches, () => false);
  const viewportH = useSyncExternalStore(subscribePhone, () => window.visualViewport?.height ?? window.innerHeight, () => 800);
  const viewportW = useSyncExternalStore(subscribePhone, () => window.visualViewport?.width ?? window.innerWidth, () => 1280);
  const maxPanelWidth = Math.max(360, Math.min(720, viewportW - 372));
  const visiblePanelWidth = Math.min(panelWidth ?? Math.min(560, Math.max(400, Math.round(viewportW * 0.28))), maxPanelWidth);
  const [sheet, setSheet] = useState<SheetSnap>("half");
  const [dragH, setDragH] = useState<number | null>(null);
  const sheetDrag = useRef<{ y: number; h: number; moved: boolean } | null>(null);
  // With a plan, the collapsed sheet still shows the assistant's message box.
  const sheetHeights: Record<SheetSnap, number> = { peek: SHEET_PEEK + ((view === "edit" || !plan) && stops.length ? 70 : 0), half: Math.round(viewportH * 0.52), full: viewportH - 72 };
  const sheetH = dragH ?? sheetHeights[sheet];
  const now = useNycNow();
  const resizeStart = useRef<{ x: number; width: number } | null>(null);
  const panelRef = useRef<HTMLElement>(null);

  const full = stops.length >= MAX_STOPS;

  // --- planning ---------------------------------------------------------------

  const runPlan = useCallback(async (nextStops: StopInput[], next: Settings, withProfile?: Profile) => {
    if (!nextStops.length) return;
    setPlanning(true);
    setPlanError(null);
    const request: PlanRequest = {
      ...next,
      // After the spread: the stops passed in are the day to plan, whatever else `next` carries.
      stops: nextStops,
      returnToOrigin: next.origin ? next.returnToOrigin : false,
      profile: withProfile ?? profileRef.current,
    };
    try {
      const res = await fetch("/api/plan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(request) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't plan the day.");
      const planned = body as DayPlan;
      setPlan(planned);
      setAnnounce(dayAnnouncement(planned));
      // The server starts a day planned for today from now; keep the form in step so it doesn't read as edited.
      if (planned.request.startMin !== request.startMin) setSettings((s) => ({ ...s, startMin: planned.request.startMin }));
      setView("plan");
      // On a phone, a new plan opens the sheet halfway: the day's summary over its map.
      setSheet("half");
      // The address bar always holds the current day, so refresh or bookmark keeps it.
      window.history.replaceState(null, "", `/plan?plan=${encodePlan(planned.request)}`);
      setActiveKey(null);
      panelRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setPlanError(e instanceof Error ? e.message : "Couldn't plan the day.");
    } finally {
      setPlanning(false);
    }
  }, []);

  useEffect(() => {
    if (!plan) return;
    let cancelled = false;
    routedLegs(plan).then((legs) => {
      if (!cancelled) setGeometry({ for: plan, legs });
    });
    return () => {
      cancelled = true;
    };
  }, [plan]);

  // Where a meal break falls, look up a few places to eat there.
  const mealLookups = useMemo(() => (plan ? mealsNeedingOptions(plan, choices, noFood) : []), [plan, choices, noFood]);
  const mealLookupKey = mealLookups.map(({ kind, stop }) => mealSpotKey(kind, stop)).join("|");
  useEffect(() => {
    if (!plan || !mealLookups.length) return;
    let cancelled = false;
    const exclude = plan.request.stops.map((s) => s.key).join(",");
    for (const { kind, stop } of mealLookups) {
      const i = plan.stops.indexOf(stop);
      const near = plan.stops.slice(0, i).reverse().find((x) => !isMealBreak(x)) ?? plan.stops.slice(i + 1).find((x) => !isMealBreak(x));
      const params = new URLSearchParams({ lat: String(stop.lat), lon: String(stop.lon), meal: kind, exclude });
      fetch(`/api/food?${params}`)
        .then((res) => (res.ok ? res.json() : { options: [] }))
        .catch(() => ({ options: [] }))
        .then((body: { options: ChoiceOption[] }) => {
          if (cancelled) return;
          if (!body.options.length) return setNoFood((set) => new Set(set).add(mealSpotKey(kind, stop)));
          const group: Choice = {
            id: mealChoiceId(kind),
            kind: "meal",
            meal: kind,
            title: MEAL_WINDOW[kind].label,
            currentKey: null,
            options: body.options,
            anchor: { lat: stop.lat, lon: stop.lon, near: near?.name ?? null },
          };
          setChoices((list) => [...list.filter((c) => c.id !== group.id), group]);
        });
    }
    return () => {
      cancelled = true;
    };
    // `mealLookupKey` names the lookups; the list itself is rebuilt every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mealLookupKey]);

  function pickChoice(choice: Choice, option: ChoiceOption | null) {
    if (!plan) return;
    const nextStops = fillSlot(plan.request.stops, choice.currentKey, option);
    if (nextStops.length > MAX_STOPS) return;
    const next: Settings = choice.meal ? { ...settings, meals: { ...settings.meals, [choice.meal]: true } } : settings;
    setChoices((list) => list.map((c) => (c.id === choice.id ? { ...c, currentKey: option?.key ?? null } : c)));
    setStops(nextStops);
    setSettings(next);
    void runPlan(nextStops, next);
  }

  // The next 16 days' weather, once: for the day strip, the header and each stop.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/weather")
      .then((res) => (res.ok ? res.json() : null))
      .then((body: Forecast | null) => {
        if (!cancelled && body) setForecast(body);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const photoTargets = useMemo(
    () => (plan ? plan.stops.filter((s) => !isMealBreak(s) && !catalogPhoto(s.attractionId) && !(s.key in placePhotos)).slice(0, 6) : []),
    [plan, placePhotos],
  );
  const photoTargetKey = photoTargets.map((s) => s.key).join("|");
  useEffect(() => {
    for (const s of photoTargets) {
      const params = new URLSearchParams({ name: s.name, lat: String(s.lat), lon: String(s.lon) });
      fetch(`/api/photo?${params}`)
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null)
        .then((body: { url: string } | null) => setPlacePhotos((m) => ({ ...m, [s.key]: body?.url ?? null })));
    }
    // `photoTargetKey` names the lookups; the list itself is rebuilt every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoTargetKey]);

  const photos = useMemo(() => {
    const out: Record<string, string> = {};
    for (const s of plan?.stops ?? []) {
      const url = catalogPhoto(s.attractionId) ?? placePhotos[s.key];
      if (url && !isMealBreak(s)) out[s.key] = url;
    }
    return out;
  }, [plan, placePhotos]);

  function pickDate(date: string) {
    if (!plan) return;
    const next: Settings = { ...settings, date };
    setSettings(next);
    setStops(plan.request.stops);
    void runPlan(plan.request.stops, next);
  }

  // "Find something that fits my trip": search, preview, add.
  const discover = useDiscover(showingPlanForDiscover(plan, view));

  function applyChatPlan(next: DayPlan) {
    setPlan(next);
    setAnnounce(dayAnnouncement(next));
    setStops(next.request.stops);
    setSettings({ ...next.request, keepOrder: next.request.keepOrder ?? false });
    setProfileOverride(next.request.profile);
    setChoices([]);
    setActiveKey(null);
    setPlanError(null);
    window.history.replaceState(null, "", `/plan?plan=${encodePlan(next.request)}`);
  }

  function downloadCalendar() {
    if (!plan) return;
    const link = `${window.location.origin}/plan?plan=${encodePlan(plan.request)}`;
    const url = URL.createObjectURL(new Blob([planToIcs(plan, link)], { type: "text/calendar;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `planyt-${plan.request.date}.ics`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    note("Calendar file downloaded");
  }

  /** Playback reached a stop: light up its card and bring it into view. */
  const followStop = useCallback((key: string | null) => {
    setActiveKey(key);
    if (key) panelRef.current?.querySelector(`[data-stop="${CSS.escape(key)}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, []);

  // --- assistant --------------------------------------------------------------

  const ask = useCallback(
    async (text: string, current: Settings, opts?: { skipQuestions?: boolean }) => {
      if (text.trim().length < 3) return;
      setThinking(true);
      setAssistantError(null);
      setAssistant(null);
      if (!opts?.skipQuestions) setFollowUpQs(null);
      try {
        const res = await fetch("/api/assistant", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            text,
            profile: profileRef.current,
            skipQuestions: opts?.skipQuestions === true,
          }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "The assistant couldn't help with that.");
        const r = body as AssistantResult;
        // When / who missing: ask before planning (empty stops until answered or skipped).
        if (r.questions?.length) {
          pendingPrompt.current = text;
          setFollowUpQs(r.questions);
          setAssistant({ reply: r.reply, unresolved: [] });
          return;
        }
        setFollowUpQs(null);
        const next: Settings = {
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
        const nextProfile: Profile = { ...profileRef.current, ...r.profile, ...groupWalk };
        if (Object.keys(r.profile).length) {
          setProfileOverride(nextProfile);
          storeProfile(nextProfile);
        }
        setSettings(next);
        setAssistant({ reply: r.reply, unresolved: r.unresolved, planned: r.stops.length > 0 });
        // Catalog stops at their typical length take the traveler's pace.
        const pace = <T extends StopInput>(s: T): T => {
          const a = s.attractionId ? ATTRACTION_BY_ID.get(s.attractionId) : undefined;
          return a && s.visitMin === a.visitMin ? { ...s, visitMin: visitFor(a, nextProfile.pace) } : s;
        };
        const paced = r.stops.map(pace);
        setChoices((r.choices ?? []).map((c) => ({ ...c, options: c.options.map(pace) })));
        if (paced.length) {
          setStops(paced);
          await runPlan(paced, next, nextProfile);
        }
      } catch (e) {
        setAssistantError(e instanceof Error ? e.message : "The assistant couldn't help with that.");
      } finally {
        setThinking(false);
      }
    },
    [runPlan],
  );

  const plannedShared = useRef(false);
  useEffect(() => {
    if (!shared?.stops.length || plannedShared.current) return;
    plannedShared.current = true;
    void runPlan(shared.stops, settings);
    // Runs once for the link it arrived with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shared, runPlan]);

  // A prompt from the landing page runs once, on arrival.
  const asked = useRef(false);
  useEffect(() => {
    if (!initialPrompt || asked.current) return;
    asked.current = true;
    void ask(initialPrompt, settings);
    // Settings are the defaults at this point; later edits must not re-run it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt, ask]);

  // --- stops ------------------------------------------------------------------

  function toggleAttraction(a: Attraction) {
    setStops((list) =>
      list.some((s) => s.key === a.id)
        ? list.filter((s) => s.key !== a.id)
        : list.length >= MAX_STOPS
          ? list
          : [...list, { ...stopFromAttraction(a), visitMin: visitFor(a, profile.pace) }],
    );
  }

  function setFixed(key: string, fixedStartMin: number | null) {
    setStops((list) => list.map((s) => (s.key === key ? { ...s, fixedStartMin } : s)));
  }

  function replan(c: ReplanChoice) {
    if (!plan) return;
    const remaining = plan.request.stops.filter((s) => c.keep.has(s.key));
    const next: Settings = {
      ...settings,
      date: nycToday(),
      startMin: c.startMin,
      endMin: Math.max(plan.request.endMin, c.startMin + 60),
      origin: c.from,
      returnToOrigin: false,
      // A meal already eaten is not planned again.
      meals: { lunch: plan.request.meals.lunch && plan.stops.some((s) => s.meal === "lunch" && c.keep.has(s.key)), dinner: plan.request.meals.dinner && plan.stops.some((s) => s.meal === "dinner" && c.keep.has(s.key)) },
    };
    setStops(remaining);
    setSettings(next);
    setReplanOpen(false);
    void runPlan(remaining, next);
  }

  function addStop(stop: StopInput) {
    setStops((list) => (list.some((s) => s.key === stop.key) || list.length >= MAX_STOPS ? list : [...list, stop]));
  }

  // --- map --------------------------------------------------------------------

  const showingPlan = view === "plan" && plan !== null;
  const mapStops: MapStop[] = useMemo(
    () =>
      showingPlan
        ? plan.stops
            .filter((s) => !isMealBreak(s))
            .map((s, i) => ({
              key: s.key,
              name: s.name,
              lat: s.lat,
              lon: s.lon,
              number: i + 1,
              photo: catalogPhoto(s.attractionId) ?? placePhotos[s.key] ?? null,
              time: `${clock(s.startMin)} – ${clock(s.endMin)}`,
            }))
        : stops.map((s) => ({ key: s.key, name: s.name, lat: s.lat, lon: s.lon, number: null })),
    [showingPlan, plan, stops, placePhotos],
  );
  const mapLegs = useMemo(() => (showingPlan ? (geometry.for === plan ? geometry.legs : straightLegs(plan)) : []), [showingPlan, plan, geometry]);
  const player = useMemo(() => (showingPlan ? { timeline: buildTimeline(plan, mapLegs), dow: plan.dow } : null), [showingPlan, plan, mapLegs]);
  const chosen = useMemo(() => stops.flatMap((s) => (s.attractionId ? [s.attractionId] : [])), [stops]);
  const mapOrigin = showingPlan ? plan.request.origin : settings.origin;

  function inspectAttraction(a: Attraction) {
    const inDay = stops.find((s) => s.key === a.id);
    setInspect({ key: a.id, name: a.name, lat: a.lat, lon: a.lon, attractionId: a.id, visitMin: inDay?.visitMin ?? a.visitMin });
  }

  function inspectStop(s: StopInput) {
    setInspect({ key: s.key, name: s.name, lat: s.lat, lon: s.lon, attractionId: s.attractionId, visitMin: s.visitMin });
  }

  /** A place picked on the 3D map: our catalog's entry when it's one of ours, else the place itself. */
  function onPickPlace(place: { name: string; lat: number; lon: number }) {
    const words = (s: string) => s.toLowerCase().replace(/^the\s+/, "");
    const ours = ATTRACTIONS.find((a) => haversine(a, place) < 250 && (words(place.name).includes(words(a.name)) || words(a.name).includes(words(place.name))));
    if (ours) return inspectAttraction(ours);
    const inDay = stops.find((s) => haversine(s, place) < 60);
    if (inDay) return inspectStop(inDay);
    const key = `place-${place.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60)}`;
    setInspect({ key, name: place.name, lat: place.lat, lon: place.lon, attractionId: null, visitMin: 60 });
  }

  function onPickAttraction(id: string) {
    const a = ATTRACTION_BY_ID.get(id);
    if (a) inspectAttraction(a);
  }

  function onPickStop(key: string) {
    const s = (showingPlan ? plan.stops : stops).find((x) => x.key === key) ?? stops.find((x) => x.key === key);
    if (!s) return;
    if (showingPlan) setActiveKey(key);
    inspectStop(s);
  }

  function toggleInspected(p: InspectPlace) {
    const a = p.attractionId ? ATTRACTION_BY_ID.get(p.attractionId) : undefined;
    if (a) return toggleAttraction(a);
    setStops((list) =>
      list.some((s) => s.key === p.key) ? list.filter((s) => s.key !== p.key) : list.length >= MAX_STOPS ? list : [...list, { ...p }],
    );
  }

  const closeInspect = useCallback(() => setInspect(null), []);

  const planCode = plan ? encodePlan(plan.request) : null;
  const isSaved = planCode !== null && savedPlans.some((p) => p.code === planCode);

  function note(text: string) {
    setShareNote(text);
    window.setTimeout(() => setShareNote((n) => (n === text ? null : n)), 2500);
  }

  function savePlan() {
    if (!plan || !planCode) return;
    if (isSaved) {
      storeSaved(savedPlans.filter((p) => p.code !== planCode));
      return note("Removed from saved plans");
    }
    const entry: SavedPlan = { id: `${Date.now().toString(36)}`, title: planTitle(plan.request), savedAt: new Date().toISOString(), code: planCode };
    note(storeSaved([entry, ...savedPlans]) ? "Saved on this device" : "Couldn't save here. Copy the link instead.");
  }

  async function sharePlan() {
    if (!planCode) return;
    const url = `${window.location.origin}/plan?plan=${planCode}`;
    try {
      await navigator.clipboard.writeText(url);
      note("Link copied");
    } catch {
      window.prompt("Copy this link", url);
    }
  }

  function openSaved(p: SavedPlan) {
    const r = decodePlan(p.code);
    if (!r?.stops.length) return;
    const today = nycToday();
    const next: Settings = {
      date: r.date < today ? today : r.date,
      startMin: r.startMin,
      endMin: r.endMin,
      mode: r.mode,
      crowd: r.crowd,
      origin: r.origin,
      returnToOrigin: r.returnToOrigin,
      meals: r.meals,
      keepOrder: r.keepOrder ?? false,
    };
    setStops(r.stops);
    setSettings(next);
    setChoices([]);
    setProfileOverride(r.profile);
    void runPlan(r.stops, next, r.profile);
  }

  // Edits after planning make the itinerary stale; say so rather than silently showing the old day.
  const currentCode = stops.length ? encodePlan({ stops, ...settings, returnToOrigin: settings.origin ? settings.returnToOrigin : false, profile }) : null;
  const suggestions = useMemo(
    () => suggestFor(profile, weekdayOf(settings.date), new Set(stops.map((s) => s.key))),
    [profile, settings.date, stops],
  );
  const stale = plan !== null && currentCode !== null && currentCode !== planCode;
  // --- phone sheet ---------------------------------------------------------------

  function sheetDown(e: React.PointerEvent) {
    if (!isPhone) return;
    sheetDrag.current = { y: e.clientY, h: sheetH, moved: false };
  }
  function sheetMove(e: React.PointerEvent) {
    const d = sheetDrag.current;
    if (!d) return;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.abs(dy) < 6) return;
    if (!d.moved) e.currentTarget.setPointerCapture(e.pointerId);
    d.moved = true;
    setDragH(Math.max(110, Math.min(sheetHeights.full, d.h - dy)));
  }
  function sheetUp() {
    const d = sheetDrag.current;
    sheetDrag.current = null;
    if (!d?.moved || dragH === null) return;
    // Snap to the nearest height.
    const nearest = (Object.keys(sheetHeights) as SheetSnap[]).reduce((a, b) => (Math.abs(sheetHeights[b] - dragH) < Math.abs(sheetHeights[a] - dragH) ? b : a));
    setSheet(nearest);
    setDragH(null);
  }
  const cycleSheet = () => setSheet((s) => (s === "peek" ? "half" : s === "half" ? "full" : "peek"));

  const isPlanToday = showingPlan && plan.request.date === nycToday();
  /** What a collapsed sheet says: the next thing to do today, or the day in a line. */
  const sheetSummary = showingPlan
    ? isPlanToday
      ? nextLine(nextStep(plan, now), now)
      : `${WEEKDAYS[plan.dow].slice(0, 3)} · ${clock(plan.stops[0]?.startMin ?? plan.request.startMin)}–${clock(plan.summary.finishMin)} · ${plan.stops.filter((s) => !isMealBreak(s)).length} stops`
    : stops.length
      ? `${stops.length} ${stops.length === 1 ? "stop" : "stops"} picked`
      : "Plan your day";



  const longDate = new Date(`${showingPlan ? plan.request.date : settings.date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
  const tabs = plan && <ViewTabs view={view} onChange={setView} />;
  const atPlaces = duration(stops.reduce((sum, s) => sum + s.visitMin, 0));
  const buildPlan = () => {
    // Planning from the builder finds the best order again.
    const next = { ...settings, keepOrder: false };
    setSettings(next);
    setTrayOpen(false);
    void runPlan(stops, next);
  };

  // ---------------------------------------------------------------------------

  return (
    <main className="ed-planner ed-paper" style={isPhone ? ({ "--sheet-h": `${sheetH}px` } as React.CSSProperties) : undefined}>
      <a href="#planner-content" className="pl-skip">
        Skip to the planner
      </a>
      <p role="status" aria-live="polite" className="sr-only">
        {announce}
      </p>
      <header className="pl-mast">
        <Logo onHome={() => setView("edit")} />
        <p className="pl-dateline pl-mono">The day planner · New York · {longDate}</p>
        <nav aria-label="Planner">
          {tabs}
          <button type="button" onClick={() => setView("edit")} className="ed-navlink pl-mono">
            Home
          </button>
          <AccountMenu account={account} />
          <ThemeToggle className="ed-theme" />
        </nav>
      </header>

      <div className="pl-body">
        <aside ref={panelRef} style={isPhone ? undefined : { width: visiblePanelWidth, flex: "none" }} className="pl-col ed-paper" aria-label="Your day">
          {/* Phones: this bar is the sheet's handle. Drag it, or tap the grip to cycle heights. */}
          <header onPointerDown={sheetDown} onPointerMove={sheetMove} onPointerUp={sheetUp} onPointerCancel={sheetUp} className="pl-sheetbar ed-paper sticky top-0 z-30">
            <button type="button" onClick={cycleSheet} aria-label={`Panel ${sheet === "peek" ? "collapsed" : sheet === "half" ? "at half height" : "full height"}. ${sheet === "full" ? "Collapse it" : "Make it taller"}`} className="pl-grip" />
            <div className="flex items-center justify-between gap-3">
              <p className={`pl-mono min-w-0 flex-1 truncate ${isPlanToday ? "pl-kicker" : ""}`}>{sheetSummary}</p>
              <ThemeToggle className="ed-theme" />
            </div>
            {tabs}
          </header>

          <div id="planner-content" tabIndex={-1} className="pl-content">
            {/* Kept mounted while editing, so the conversation with the assistant survives a trip to Build. */}
            {plan && (
              <div hidden={!showingPlan}>
                {planning ? (
                  <p role="status" className="pl-note mb-6 flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" aria-hidden /> Re-planning your day…
                  </p>
                ) : (
                  stale && (
                    <div className="pl-note mb-6 flex flex-wrap items-center justify-between gap-3">
                      <span>You changed your stops or settings.</span>
                      <button type="button" onClick={() => runPlan(stops, settings)} className="ed-btn">
                        <RefreshCw aria-hidden /> Re-plan
                      </button>
                    </div>
                  )
                )}
                {planError && (
                  <p role="alert" className="pl-flag mb-6">
                    {planError}
                  </p>
                )}
                {isPlanToday && <NextUp plan={plan} onReplan={() => setReplanOpen(true)} />}
                <Itinerary
                  plan={plan}
                  activeKey={activeKey}
                  isSaved={isSaved}
                  shareNote={shareNote}
                  onActivate={setActiveKey}
                  onInspect={inspectStop}
                  onEdit={() => {
                    setMode("pick");
                    setView("edit");
                  }}
                  onAsk={() => assistantHandle.current?.open()}
                  note={assistant?.planned ? assistant : null}
                  onDismissNote={() => setAssistant(null)}
                  onSave={savePlan}
                  onShare={sharePlan}
                  onCalendar={downloadCalendar}
                  forecast={forecast}
                  photos={photos}
                  phone={planCode && <PhoneSend key={planCode} planCode={planCode} defaultHandle={account.phoneNumber} />}
                  budget={<Budget request={plan.request} people={partySize(profile)} onPeople={(people) => {
                    const next = { ...profileRef.current, people };
                    setProfileOverride(next);
                    storeProfile(next);
                  }} />}
                  dayPicker={<DayPicker plan={plan} forecast={forecast} busy={planning} onPickDate={pickDate} />}
                  choices={
                    <ChoicePanel
                      plan={plan}
                      choices={choicesFor(plan, choices)}
                      busy={planning}
                      full={plan.request.stops.length >= MAX_STOPS}
                      loadingMeals={mealLookups.length > 0}
                      onPick={pickChoice}
                    />
                  }
                />
                {replanOpen && <ReplanDialog plan={plan} busy={planning} onReplan={replan} onClose={() => setReplanOpen(false)} />}
              </div>
            )}

            {!showingPlan && (
              <div>
                {mode === "describe" ? (
                  // The main way in: say the day. The assistant reads the date, hours, company, pace and start point from it.
                  <section aria-labelledby="ask-heading">
                    <p className="pl-mono pl-kicker">Plan a day · New York</p>
                    <h1 id="ask-heading" className="pl-title">
                      Where to, <em>today?</em>
                    </h1>
                    <p className="pl-dek">Tell us the day you want: when, who&apos;s coming, what you love, where you&apos;re staying. We plan it around the crowds and the travel.</p>
                    <form
                      suppressHydrationWarning
                      className="ed-prompt pl-prompt"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void ask(prompt, settings);
                      }}
                    >
                      <textarea
                        ref={promptRef}
                        suppressHydrationWarning
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            void ask(prompt, settings);
                          }
                        }}
                        rows={3}
                        maxLength={1500}
                        placeholder="Saturday with my parents, staying in Midtown: a museum, a skyline view and pizza. Avoid crowds."
                        aria-label="Describe your day"
                      />
                      <div className="pl-prompt-foot">
                        <span className="pl-small pl-muted max-sm:hidden">Enter to plan · Shift+Enter for a new line</span>
                        <button type="submit" disabled={thinking || prompt.trim().length < 3} className="ed-btn ml-auto">
                          {thinking ? <Loader2 className="animate-spin" aria-hidden /> : null}
                          {thinking ? "Building your day…" : "Build my day"}
                          {!thinking && <ArrowRight aria-hidden />}
                        </button>
                      </div>
                    </form>
                    <p className="pl-alt">
                      <span className="pl-muted">Know exactly where you want to go?</span>{" "}
                      <button type="button" onClick={() => setMode("pick")} className="pl-link">
                        Pick places yourself{stops.length ? ` (${stops.length} picked)` : ""}
                      </button>
                    </p>
                    <div aria-live="polite">
                      {assistantError && <p className="pl-flag mt-4">{assistantError}</p>}
                      {assistant && !assistant.planned && (
                        <div className="pl-note mt-4">
                          <p>{assistant.reply}</p>
                          {assistant.unresolved.length > 0 && <p className="pl-muted mt-2">Couldn&apos;t find on the map: {assistant.unresolved.join(", ")}. Try naming them differently, or pick them yourself.</p>}
                          {followUpQs && (
                            <FollowUpQuestions
                              questions={followUpQs}
                              disabled={thinking}
                              onDone={(answers) => {
                                setFollowUpQs(null);
                                void ask(withAnswers(pendingPrompt.current || prompt, answers), settings, { skipQuestions: true });
                              }}
                              onSkip={() => {
                                setFollowUpQs(null);
                                void ask(pendingPrompt.current || prompt, settings, { skipQuestions: true });
                              }}
                            />
                          )}
                        </div>
                      )}
                    </div>

                    <div className="pl-folds">
                      <Fold kicker="Plan with friends" title={<>Make it a <em>group day</em></>} summary="Open a trip room or pick up where your group left off.">
                        <GroupTrips />
                      </Fold>
                    </div>

                    {/* Ideas: a tap fills the prompt, ready to change or send. Filtered by who's coming. */}
                    <section aria-labelledby="ideas-heading" className="pl-ideas">
                      <h2 id="ideas-heading" className="pl-mono pl-kicker">
                        Or start from an idea
                      </h2>
                      <div className="pl-chips pl-idea-filter" role="group" aria-label="Ideas for">
                        {([null, ...(Object.keys(PARTY_LABEL) as Party[])] as (Party | null)[]).map((p) => (
                          <button key={p ?? "all"} type="button" aria-pressed={ideaParty === p} onClick={() => setIdeaParty(p)} className="pl-chip">
                            {p ? PARTY_LABEL[p] : "Everyone"}
                          </button>
                        ))}
                      </div>
                      <ul>
                        {TRIP_STARTERS.filter((idea) => !ideaParty || idea.who === ideaParty).map((idea) => {
                          const photo = catalogPhoto(idea.photo);
                          return (
                            <li key={idea.label}>
                              <button
                                type="button"
                                onClick={() => {
                                  setPrompt(idea.prompt);
                                  promptRef.current?.focus();
                                }}
                                className="pl-idea"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <span className="pl-idea-photo">{photo && <img src={photo} alt="" loading="lazy" referrerPolicy="no-referrer" />}</span>
                                <span className="min-w-0">
                                  <span className="pl-idea-title">{idea.label}</span>
                                  <span className="pl-idea-who pl-mono">{PARTY_LABEL[idea.who]}</span>
                                  <span className="pl-idea-blurb">{idea.blurb}</span>
                                </span>
                                <ArrowRight className="pl-idea-arrow" aria-hidden />
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  </section>
                ) : (
                  // The quieter way in: choose places by hand; they collect in the tray below.
                  <section aria-labelledby="pick-heading">
                    <button type="button" onClick={() => setMode("describe")} className="pl-textbtn pl-mono">
                      <ArrowLeft aria-hidden /> Describe it instead
                    </button>
                    <h1 id="pick-heading" className="pl-title">
                      Pick places, <em>we&apos;ll order them</em>
                    </h1>
                    <p className="pl-dek mb-5">
                      {stops.length ? `${stops.length} picked. Add more, or plan your day from the tray below.` : `Tap + on a photo, or a dot on the map. Add at least one place (up to ${MAX_STOPS}), then plan.`}
                    </p>
                    <StopPicker stops={stops} suggestions={suggestions} onAdd={addStop} onToggle={toggleAttraction} onInspect={inspectAttraction} full={full} />
                  </section>
                )}

                {savedPlans.length > 0 && (
                  <div className="pl-folds">
                    <Fold kicker="Saved on this device" title={<>Pick up <em>where you left off</em></>} summary={`${savedPlans.length} saved ${savedPlans.length === 1 ? "plan" : "plans"}: ${savedPlans[0].title}${savedPlans.length > 1 ? "…" : ""}`}>
                      <ul className="pl-saved">
                        {savedPlans.slice(0, 5).map((p) => (
                          <li key={p.id}>
                            <button type="button" onClick={() => openSaved(p)} disabled={planning} className="name">
                              {p.title}
                            </button>
                            <button type="button" onClick={() => storeSaved(savedPlans.filter((x) => x.id !== p.id))} className="pl-icon" aria-label={`Delete saved plan ${p.title}`}>
                              <Trash2 aria-hidden />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </Fold>
                  </div>
                )}
              </div>
            )}
          </div>

          {!showingPlan &&
            (stops.length > 0 || planError || removed) && (
              <div className="pl-dock ed-paper">
                {stops.length > 0 && (
                  <>
                    <button type="button" aria-expanded={trayOpen} aria-controls="tray-list" onClick={() => setTrayOpen((v) => !v)} className="pl-tray-head">
                      <span className="pl-thumbs" aria-hidden>
                        {stops.map((s, i) => {
                          const photo = catalogPhoto(s.attractionId);
                          return (
                            <span key={s.key} className="pl-thumb">
                              {photo ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={photo} alt="" referrerPolicy="no-referrer" />
                              ) : (
                                <MapPin className="m-auto mt-[0.55em] size-[1em] opacity-50" />
                              )}
                              <b>{i + 1}</b>
                            </span>
                          );
                        })}
                      </span>
                      <span className="pl-mono min-w-0 shrink-0">
                        {stops.length}/{MAX_STOPS} · {atPlaces}
                        <span className="pl-muted max-sm:hidden"> · {trayOpen ? "Done" : "Edit"}</span>
                      </span>
                      <ChevronUp aria-hidden />
                    </button>
                    {trayOpen && (
                      <ol id="tray-list" className="pl-tray-list" aria-label="Your stops">
                        {stops.map((s, i) => {
                          const options = VISIT_OPTIONS.includes(s.visitMin) ? VISIT_OPTIONS : [...VISIT_OPTIONS, s.visitMin].sort((x, y) => x - y);
                          return (
                            <li key={s.key}>
                              <span className="pl-bullet" aria-hidden>
                                {i + 1}
                              </span>
                              <button type="button" onClick={() => inspectStop(s)} aria-haspopup="dialog" className="name">
                                {s.name}
                              </button>
                              <span className="flex items-center gap-1">
                                {s.fixedStartMin != null ? (
                                  <span className="inline-flex items-center pl-red">
                                    <label className="sr-only" htmlFor={`fixed-${s.key}`}>
                                      Start time for {s.name}
                                    </label>
                                    <input
                                      id={`fixed-${s.key}`}
                                      type="time"
                                      value={toHHMM(s.fixedStartMin)}
                                      onChange={(e) => {
                                        const m = toMinutes(e.target.value);
                                        if (m !== null) setFixed(s.key, m);
                                      }}
                                      className="pl-select"
                                    />
                                    <button type="button" onClick={() => setFixed(s.key, null)} aria-label={`Clear the set time for ${s.name}`} className="pl-icon">
                                      <X aria-hidden />
                                    </button>
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setFixed(s.key, Math.max(settings.startMin, 12 * 60))}
                                    title="Must start at a set time (a booking, a show)"
                                    aria-label={`Set a start time for ${s.name}`}
                                    className="pl-icon"
                                  >
                                    <Clock aria-hidden />
                                  </button>
                                )}
                                <label className="sr-only" htmlFor={`visit-${s.key}`}>
                                  Time at {s.name}
                                </label>
                                <select
                                  id={`visit-${s.key}`}
                                  value={s.visitMin}
                                  onChange={(e) => {
                                    const v = Number(e.target.value);
                                    setStops((list) => list.map((x) => (x.key === s.key ? { ...x, visitMin: v } : x)));
                                  }}
                                  className="pl-select"
                                >
                                  {options.map((m) => (
                                    <option key={m} value={m}>
                                      {duration(m)}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRemoved({ stop: s, index: i });
                                    setStops((list) => list.filter((x) => x.key !== s.key));
                                  }}
                                  className="pl-icon"
                                  aria-label={`Remove ${s.name}`}
                                >
                                  <X aria-hidden />
                                </button>
                              </span>
                            </li>
                          );
                        })}
                      </ol>
                    )}
                  </>
                )}
                {removed && (
                  <p role="status" className="pl-undo">
                    <span className="min-w-0 truncate">Removed {removed.stop.name}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const { stop, index } = removed;
                        setStops((list) => (list.some((x) => x.key === stop.key) || list.length >= MAX_STOPS ? list : [...list.slice(0, index), stop, ...list.slice(index)]));
                        setRemoved(null);
                      }}
                      className="pl-link"
                    >
                      Undo
                    </button>
                  </p>
                )}
                {planError && (
                  <p role="alert" className="pl-flag mb-2">
                    {planError}
                  </p>
                )}
                <button type="button" onClick={buildPlan} disabled={planning || stops.length === 0} className="ed-btn">
                  {planning ? <Loader2 className="animate-spin" aria-hidden /> : null}
                  {planning ? "Finding the best order…" : stops.length ? `Plan my day · ${stops.length} stop${stops.length > 1 ? "s" : ""}` : "Add a place to start"}
                  {!planning && stops.length > 0 && <ArrowRight aria-hidden />}
                </button>
              </div>
            )}
        </aside>

        <div
          role="separator"
          aria-label="Resize map and itinerary panel"
          aria-orientation="vertical"
          aria-valuemin={360}
          aria-valuemax={maxPanelWidth}
          aria-valuenow={visiblePanelWidth}
          tabIndex={0}
          onPointerDown={(e) => {
            resizeStart.current = { x: e.clientX, width: visiblePanelWidth };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!resizeStart.current) return;
            setPanelWidth(Math.max(360, Math.min(maxPanelWidth, resizeStart.current.width + e.clientX - resizeStart.current.x)));
          }}
          onPointerUp={() => {
            resizeStart.current = null;
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
              e.preventDefault();
              setPanelWidth(Math.max(360, Math.min(maxPanelWidth, visiblePanelWidth + (e.key === "ArrowRight" ? 24 : -24))));
            }
          }}
          className="pl-resizer"
        >
          <span />
        </div>

        {/* Kept mounted with a plan, hidden in Build, so the conversation survives a trip there. */}
        {plan && (
          <div hidden={!showingPlan}>
            <Assistant unread={unread} onOpenChange={onAssistantOpen} handle={assistantHandle}>
              <TripChat plan={plan} discover={discover} planning={planning || stale} onApply={applyChatPlan} onReply={() => !assistantOpen.current && setUnread(true)} onView={(place) => {
                assistantHandle.current?.close();
                setPeek(place);
              }} />
            </Assistant>
          </div>
        )}

        <div className="pl-mobile-brand ed-paper">
          <Logo onHome={() => setView("edit")} />
        </div>
        <figure className="pl-plate">
          <figcaption className="pl-caption pl-mono">
            <span>Plate · {showingPlan ? "Your day, live" : "New York, live"}</span>
            <span>{showingPlan ? "Press play to watch the day" : "Tap a place to look closer"}</span>
          </figcaption>
          <div className="pl-frame">
            <PlanMap
              stops={mapStops}
              origin={mapOrigin}
              legs={mapLegs}
              chosen={chosen}
              activeKey={activeKey}
              onPickAttraction={onPickAttraction}
              onPickStop={onPickStop}
              onPickPlace={onPickPlace}
              player={player}
              onPlayerKey={followStop}
              bottomInset={isPhone ? sheetHeights[sheet] : 0}
              // On a phone the player steps aside while the sheet is full or found places are on the map.
              hideOverlays={isPhone && (sheet === "full" || discover.preview !== null)}
              discover={discover.preview}
              onDiscoverSelect={discover.select}
              onPlayingChange={(playing) => {
                // Watching the day play out needs the map, not the list.
                if (playing && isPhone) setSheet("peek");
              }}
              focus={inspect ? { key: inspect.key, lat: inspect.lat, lon: inspect.lon } : peek}
              showFilter={!showingPlan && mode === "pick"}
              className="size-full"
            />
            {inspect && (
              <PlaceSheet
                key={inspect.key}
                place={inspect}
                date={showingPlan ? plan.request.date : settings.date}
                inDay={stops.some((s) => s.key === inspect.key)}
                full={full}
                planned={showingPlan ? (plan.stops.find((s) => s.key === inspect.key) ?? null) : null}
                stopNumber={(() => {
                  if (!showingPlan) return null;
                  const i = plan.stops.filter((s) => !isMealBreak(s)).findIndex((s) => s.key === inspect.key);
                  return i === -1 ? null : i + 1;
                })()}
                onToggle={() => toggleInspected(inspect)}
                onClose={closeInspect}
              />
            )}
          </div>
        </figure>
      </div>
    </main>
  );
}

/** Build / Your day, as two tabs. */
function ViewTabs({ view, onChange }: { view: "edit" | "plan"; onChange: (v: "edit" | "plan") => void }) {
  return (
    <div role="tablist" aria-label="Panel" className="pl-tabs" onKeyDown={(e) => arrowKeys(e, '[role="tab"]')}>
      {(
        [
          ["edit", "I", "Build"],
          ["plan", "II", "Your day"],
        ] as const
      ).map(([value, numeral, label]) => (
        <button key={value} type="button" role="tab" aria-selected={view === value} tabIndex={view === value ? 0 : -1} aria-controls="planner-content" onClick={() => onChange(value)} className="pl-tab">
          <b aria-hidden>{numeral}.</b>
          {label}
        </button>
      ))}
    </div>
  );
}
