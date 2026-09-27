"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowRight, Bookmark, CalendarDays, ChevronDown, Clock, Footprints, Home, Loader2, MapPin, RefreshCw, SlidersHorizontal, Sparkles, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { ATTRACTION_BY_ID, type Attraction } from "@/lib/plan/attractions";
import { planToIcs } from "@/lib/plan/ics";
import { catalogPhoto } from "@/lib/plan/photoUrls";
import { nextStep } from "@/lib/plan/live";
import { buildTimeline } from "@/lib/plan/playback";
import type { Forecast } from "@/lib/plan/weatherCodes";
import { BRAND, KIND_COLOR, MODE_LABEL } from "@/lib/plan/display";
import { defaultSettings, fromAssistant, toRequest, type PlanSettings } from "@/lib/plan/fromAssistant";
import { locate, NEAR_ME } from "@/lib/plan/here";
import { withAnswers, type FollowUp } from "@/lib/plan/followUps";
import { DEFAULT_PROFILE, isMealBreak, partySize, suggestFor, visitFor } from "@/lib/plan/profile";
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
  CrowdPref,
  DayPlan,
  PlanRequest,
  Profile,
  StopInput,
  TravelMode,
} from "@/lib/plan/types";
import { useDiscover } from "./Discover";
import { TripChat } from "./TripChat";
import { NextUp, nextLine, useNycNow } from "./NextUp";
import { DayPicker } from "./DayPicker";
import { Itinerary } from "./Itinerary";
import { Budget } from "./Budget";
import { PhoneSend } from "./PhoneSend";
import { FollowUpQuestions } from "./FollowUpQuestions";
import type { AppAction } from "@/lib/discover/chat";
import { PlaceSheet, type InspectPlace } from "./PlaceSheet";
import { ProfileCard, profileSummary } from "./ProfileCard";
import { ReplanDialog, type ReplanChoice } from "./ReplanDialog";
import type { MapLeg, MapStop } from "./PlanMap";
import { StopPicker, stopFromAttraction } from "./StopPicker";
import { loadMemoryId, storeMemoryId } from "@/lib/memory/local";

const PlanMap = dynamic(() => import("./PlanMap").then((m) => m.PlanMap), {
  ssr: false,
  loading: () => <Skeleton className="size-full rounded-none" />,
});

const MAX_STOPS = 10;
const VISIT_OPTIONS = [15, 30, 45, 60, 75, 90, 120, 150, 180, 240];
const TRIP_STARTERS = [
  { label: "First time in NYC", prompt: "First time in NYC this Saturday. I want to see a few iconic places, get a great skyline view and eat good pizza. Keep travel simple and avoid the biggest crowds." },
  { label: "Downtown day", prompt: "Plan a day downtown with the 9/11 Memorial, Brooklyn Bridge and Chinatown for lunch. I have about 8 hours and prefer subway plus walking." },
  { label: "A slower day", prompt: "Plan a relaxed Sunday in Brooklyn with parks, a neighborhood stroll and a great place to eat. Keep walking manageable and leave room for breaks." },
];

const CROWD_SUMMARY: Record<CrowdPref, string> = { avoid: "Avoid crowds", balanced: "Some crowds okay", ignore: "Crowds okay" };

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

/** Discovery works on a planned day, shown as the itinerary. */
const showingPlanForDiscover = (plan: DayPlan | null, view: "edit" | "plan") => (view === "plan" ? plan : null);

/** Phones and small tablets get the map full screen with the panel as a bottom sheet. */
const PHONE_QUERY = "(max-width: 1023px)";
function subscribePhone(onChange: () => void) {
  const mq = window.matchMedia(PHONE_QUERY);
  mq.addEventListener("change", onChange);
  window.addEventListener("resize", onChange);
  return () => {
    mq.removeEventListener("change", onChange);
    window.removeEventListener("resize", onChange);
  };
}
type SheetSnap = "peek" | "half" | "full";
const SHEET_PEEK = 150;

type Settings = PlanSettings;


function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
      <span aria-hidden className="grid size-7 place-items-center rounded-lg bg-foreground font-display text-lg text-background">
        {BRAND.name[0]}
      </span>
      {BRAND.name} <span className="-ml-1 font-display text-lg font-normal text-muted-foreground italic">{BRAND.suffix}</span>
    </Link>
  );
}

export function PlannerView({ initialPrompt, initialPlan }: { initialPrompt: string | null; initialPlan: string | null }) {
  // A shared or saved plan fills the form before the first render; the effect below plans it.
  const [shared] = useState(() => (initialPlan ? decodePlan(initialPlan) : null));
  const [stops, setStops] = useState<StopInput[]>(() => shared?.stops ?? []);
  const [settings, setSettings] = useState<Settings>(() => {
    const today = nycToday();
    const base = defaultSettings(today);
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
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [geometry, setGeometry] = useState<{ for: DayPlan | null; legs: KeyedLeg[] }>({ for: null, legs: [] });
  const [inspect, setInspect] = useState<InspectPlace | null>(null);
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
  const [thinking, setThinking] = useState(false);
  const [assistant, setAssistant] = useState<{ reply: string; unresolved: string[] } | null>(null);
  const [assistantError, setAssistantError] = useState<string | null>(null);
  /** Questions asked before planning, with the answers picked so far. */
  const [followUp, setFollowUp] = useState<{ text: string; questions: FollowUp[] } | null>(null);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  // Photos for searched places, looked up once each; catalog photos ship with the app.
  const [placePhotos, setPlacePhotos] = useState<Record<string, string | null>>({});

  const [originText, setOriginText] = useState("");
  const [originBusy, setOriginBusy] = useState(false);
  const [originError, setOriginError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  // In the itinerary, the assistant's message box lives in the panel's sticky footer.
  const [composerEl, setComposerEl] = useState<HTMLDivElement | null>(null);
  const [panelWidth, setPanelWidth] = useState(500);
  // Phone layout: the panel is a sheet over a full-screen map, dragged between three heights.
  const isPhone = useSyncExternalStore(subscribePhone, () => window.matchMedia(PHONE_QUERY).matches, () => false);
  const viewportH = useSyncExternalStore(subscribePhone, () => window.innerHeight, () => 800);
  const [sheet, setSheet] = useState<SheetSnap>("half");
  const [dragH, setDragH] = useState<number | null>(null);
  const sheetDrag = useRef<{ y: number; h: number; moved: boolean } | null>(null);
  // With a plan, the collapsed sheet still shows the assistant's message box.
  const sheetHeights: Record<SheetSnap, number> = { peek: SHEET_PEEK + (plan && view === "plan" ? 58 : 0), half: Math.round(viewportH * 0.52), full: viewportH - 72 };
  const sheetH = dragH ?? sheetHeights[sheet];
  const now = useNycNow();
  const resizeStart = useRef<{ x: number; width: number } | null>(null);
  const panelRef = useRef<HTMLElement>(null);

  const full = stops.length >= MAX_STOPS;
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setSettings((s) => ({ ...s, [key]: value }));

  // --- planning ---------------------------------------------------------------

  const runPlan = useCallback(async (nextStops: StopInput[], next: Settings, withProfile?: Profile) => {
    if (!nextStops.length) return;
    setPlanning(true);
    setPlanError(null);
    const request: PlanRequest = toRequest(nextStops, next, withProfile ?? profileRef.current);
    try {
      const res = await fetch("/api/plan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(request) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't plan the day.");
      const planned = body as DayPlan;
      setPlan(planned);
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

  /** What Roam was asked to do in the app, for the plan it just shaped (which may not have rendered yet). */
  function runChatAction(a: AppAction, target: DayPlan) {
    if (a.action === "save") savePlan(target, true);
    if (a.action === "calendar") downloadCalendar(target);
    if (a.action === "share_link") void sharePlan(target);
    if (a.action === "new_plan" && a.text) {
      setView("edit");
      setPrompt(a.text);
      void ask(a.text, settings);
    }
  }

  function applyChatPlan(next: DayPlan) {
    setPlan(next);
    setStops(next.request.stops);
    setSettings({ ...next.request, keepOrder: next.request.keepOrder ?? false });
    setProfileOverride(next.request.profile);
    setActiveKey(null);
    setPlanError(null);
    window.history.replaceState(null, "", `/plan?plan=${encodePlan(next.request)}`);
  }

  function downloadCalendar(target: DayPlan | null = plan) {
    if (!target) return;
    const link = `${window.location.origin}/plan?plan=${encodePlan(target.request)}`;
    const url = URL.createObjectURL(new Blob([planToIcs(target, link)], { type: "text/calendar;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `roam-nyc-${target.request.date}.ics`;
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
    async (text: string, current: Settings, skipQuestions = false) => {
      if (text.trim().length < 3) return;
      setThinking(true);
      setAssistantError(null);
      setAssistant(null);
      setFollowUp(null);
      try {
        // "Cafés near me" needs to know where that is; ask the device only when the words do.
        const here = NEAR_ME.test(text) ? await locate() : null;
        const res = await fetch("/api/assistant", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text, profile: profileRef.current, here, memoryId: loadMemoryId(), skipQuestions, knowsGroup: !!readProfileRaw() }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "The assistant couldn't help with that.");
        const r = body as AssistantResult;
        storeMemoryId(r.memoryId);
        if (r.questions?.length) {
          setAssistant({ reply: r.reply, unresolved: [] });
          setFollowUp({ text, questions: r.questions });
          return;
        }
        const { settings: next, profile: nextProfile, profileChanged, stops: paced } = fromAssistant(r, current, profileRef.current);
        if (profileChanged) {
          setProfileOverride(nextProfile);
          storeProfile(nextProfile);
        }
        setSettings(next);
        setAssistant({ reply: r.reply, unresolved: r.unresolved });
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

  function updateProfile(next: Profile) {
    if (next.pace !== profile.pace) {
      // Visits still at the old pace's length follow the new pace; ones the reader set stay put.
      setStops((list) =>
        list.map((s) => {
          const a = s.attractionId ? ATTRACTION_BY_ID.get(s.attractionId) : undefined;
          return a && s.visitMin === visitFor(a, profile.pace) ? { ...s, visitMin: visitFor(a, next.pace) } : s;
        }),
      );
    }
    setProfileOverride(next);
    storeProfile(next);
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

  async function setOrigin() {
    const q = originText.trim();
    if (q.length < 2) return;
    setOriginBusy(true);
    setOriginError(null);
    try {
      const res = await fetch(`/api/resolve?q=${encodeURIComponent(q)}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't find that.");
      set("origin", { label: q, lat: body.lat, lon: body.lon });
      setOriginText("");
    } catch (e) {
      setOriginError(e instanceof Error ? e.message : "Couldn't find that.");
    } finally {
      setOriginBusy(false);
    }
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

  /** The Save button toggles; Roam's "save it" only ever saves. */
  function savePlan(target: DayPlan | null = plan, onlySave = false) {
    if (!target) return;
    const code = encodePlan(target.request);
    if (savedPlans.some((p) => p.code === code)) {
      if (onlySave) return note("Already saved on this device");
      storeSaved(savedPlans.filter((p) => p.code !== code));
      return note("Removed from saved plans");
    }
    const entry: SavedPlan = { id: `${Date.now().toString(36)}`, title: planTitle(target.request), savedAt: new Date().toISOString(), code };
    note(storeSaved([entry, ...savedPlans]) ? "Saved on this device" : "Couldn't save here. Copy the link instead.");
  }

  async function sharePlan(target: DayPlan | null = plan) {
    if (!target) return;
    const url = `${window.location.origin}/plan?plan=${encodePlan(target.request)}`;
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
  const tripSummary = [
    new Date(`${settings.date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }),
    `${clock(settings.startMin)}–${clock(settings.endMin)}`,
    MODE_LABEL[settings.mode],
    CROWD_SUMMARY[settings.crowd],
    settings.origin ? `from ${settings.origin.label}` : null,
    profileSummary(profile),
  ]
    .filter(Boolean)
    .join(" · ");

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

  // ---------------------------------------------------------------------------

  return (
    <div
      className="flex min-h-dvh flex-col max-lg:h-dvh max-lg:overflow-hidden lg:h-dvh lg:flex-row"
      style={isPhone ? ({ "--sheet-h": `${sheetH}px` } as React.CSSProperties) : undefined}
    >
      <aside
        ref={panelRef}
        style={{ "--planner-panel-width": `${panelWidth}px` } as React.CSSProperties}
        className={`order-2 flex flex-col border-border lg:order-1 lg:h-dvh lg:w-[var(--planner-panel-width)] lg:shrink-0 lg:overflow-y-auto lg:border-r max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-40 max-lg:h-(--sheet-h) max-lg:overflow-y-auto max-lg:overscroll-contain max-lg:rounded-t-[28px] max-lg:bg-background max-lg:shadow-[0_-16px_48px_-16px_oklch(0_0_0/0.4)] ${dragH === null ? "max-lg:transition-[height] max-lg:duration-300 max-lg:ease-out" : ""}`}
      >
        {/* On phones this bar is the sheet's handle: drag it, or tap the grip to cycle heights. */}
        <header
          onPointerDown={sheetDown}
          onPointerMove={sheetMove}
          onPointerUp={sheetUp}
          onPointerCancel={sheetUp}
          className="sticky top-0 z-30 flex flex-col border-b border-border bg-background/85 px-5 backdrop-blur-xl max-lg:touch-none max-lg:rounded-t-[28px] max-lg:pt-2 max-lg:pb-3 lg:py-4"
        >
          <button
            type="button"
            onClick={cycleSheet}
            aria-label={sheet === "full" ? "Collapse the panel" : "Expand the panel"}
            className="mx-auto mb-2 grid h-4 w-16 place-items-center lg:hidden"
          >
            <span className="h-1.5 w-11 rounded-full bg-foreground/20" />
          </button>
          <div className="flex items-center justify-between gap-3">
          <div className="max-lg:hidden">
            <Logo />
          </div>
          <p className={`min-w-0 flex-1 truncate text-sm font-semibold lg:hidden ${isPlanToday ? "text-brand" : ""}`}>{sheetSummary}</p>
          {plan && (
            <Segmented
              label="Panel"
              value={view}
              onChange={setView}
              options={[
                { value: "edit", label: "Build" },
                { value: "plan", label: "Itinerary" },
              ]}
            />
          )}
          </div>
        </header>

        <div className="flex-1 px-5 pt-5 pb-10">
          {/* Kept mounted while editing, so the conversation with the assistant survives a trip to Build. */}
          {plan && (
            <div hidden={!showingPlan}>
              {planning ? (
                <div role="status" className="mb-5 flex items-center gap-3 rounded-2xl border border-brand/30 bg-brand-soft px-4 py-3 text-sm">
                  <Loader2 className="size-4 animate-spin text-brand" aria-hidden /> Re-planning your day…
                </div>
              ) : (
                stale && (
                  <div className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-brand/30 bg-brand-soft px-4 py-3 text-sm">
                    <span>You changed your stops or settings.</span>
                    <Button size="sm" onClick={() => runPlan(stops, settings)} className="rounded-full bg-brand text-on-color hover:bg-brand/90">
                      <RefreshCw aria-hidden /> Re-plan
                    </Button>
                  </div>
                )
              )}
              {planError && (
                <p role="alert" className="mb-5 text-sm text-sev-c">
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
                onEdit={() => setView("edit")}
                onSave={() => savePlan()}
                onShare={() => void sharePlan()}
                onCalendar={() => downloadCalendar()}
                phone={planCode && <PhoneSend key={planCode} planCode={planCode} />}
                forecast={forecast}
                photos={photos}
                assistant={
                  <TripChat
                    plan={plan}
                    discover={discover}
                    planning={planning || stale}
                    onApply={applyChatPlan}
                    onAction={runChatAction}
                    composerTarget={composerEl}
                    onEngage={() => {
                      if (isPhone && sheet === "peek") setSheet("half");
                    }}
                  />
                }
                dayPicker={<DayPicker plan={plan} forecast={forecast} busy={planning} onPickDate={pickDate} />}
                budget={<Budget request={plan.request} people={partySize(profile)} onPeople={(people) => updateProfile({ ...profile, people })} />}
              />
              {replanOpen && <ReplanDialog plan={plan} busy={planning} onReplan={replan} onClose={() => setReplanOpen(false)} />}
            </div>
          )}
          {!showingPlan && (
            <div className="space-y-8">
              {/* Assistant */}
              <section aria-labelledby="ask-heading">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-brand">A better way around New York</p>
                <h1 id="ask-heading" className="font-display text-4xl leading-none tracking-tight">
                  Make a day of it.
                </h1>
                <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">Choose what you want to see. Roam finds an order that fits opening hours, travel time and the quieter parts of the day.</p>
                <div className="mt-4 flex gap-2 overflow-x-auto pb-1" aria-label="Trip ideas">
                  {TRIP_STARTERS.map((starter) => (
                    <button key={starter.label} type="button" onClick={() => setPrompt(starter.prompt)} className="shrink-0 rounded-full border border-border bg-card px-3 py-2 text-xs font-medium transition hover:border-brand hover:bg-brand-soft">
                      {starter.label}
                    </button>
                  ))}
                </div>
                <form
                  suppressHydrationWarning
                  className="mt-4 rounded-2xl border border-border bg-card p-2 shadow-sm transition focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/10"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void ask(prompt, settings);
                  }}
                >
                  <textarea
                    suppressHydrationWarning
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        void ask(prompt, settings);
                      }
                    }}
                    rows={3}
                    maxLength={1500}
                    placeholder="What would make this a great NYC day? Try: ‘Saturday with my parents, a museum, skyline view and pizza. Avoid crowds.’"
                    aria-label="Describe your day"
                    className="w-full resize-none bg-transparent px-2.5 py-2 text-[15px] leading-relaxed outline-none placeholder:text-muted-foreground"
                  />
                  <div className="flex items-center justify-between gap-2 px-1">
                    <span className="text-[11px] text-muted-foreground max-sm:hidden">Places, timing and travel are worked out for you</span>
                    <Button type="submit" disabled={thinking || prompt.trim().length < 3} className="ml-auto rounded-full bg-brand px-4 text-on-color hover:bg-brand/90">
                      {thinking ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
                      {thinking ? "Building your day…" : "Build my day"}
                    </Button>
                  </div>
                </form>
                <div aria-live="polite">
                  {assistantError && <p className="mt-3 text-sm text-sev-c">{assistantError}</p>}
                  {assistant && (
                    <div className="mt-3 rounded-2xl bg-brand-soft px-4 py-3 text-sm leading-relaxed">
                      <p className="flex gap-2">
                        <Sparkles className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
                        {assistant.reply}
                      </p>
                      {assistant.unresolved.length > 0 && (
                        <p className="mt-2 text-xs text-muted-foreground">Couldn&apos;t find on the map: {assistant.unresolved.join(", ")}. Try adding them by address.</p>
                      )}
                      {followUp && (
                        <FollowUpQuestions
                          key={followUp.text}
                          questions={followUp.questions}
                          disabled={thinking}
                          onDone={(answers) => {
                            const text = withAnswers(followUp.text, answers);
                            setPrompt(text);
                            void ask(text, settings, true);
                          }}
                          onSkip={() => void ask(followUp.text, settings, true)}
                        />
                      )}
                    </div>
                  )}
                </div>
              </section>

              {savedPlans.length > 0 && (
                <section aria-labelledby="saved-heading">
                  <h2 id="saved-heading" className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                    <Bookmark className="size-4 text-brand" aria-hidden /> Pick up a saved plan
                  </h2>
                  <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
                    {savedPlans.slice(0, 5).map((p) => (
                      <li key={p.id} className="flex items-center gap-2 pr-2">
                        <button type="button" onClick={() => openSaved(p)} disabled={planning} className="min-w-0 flex-1 truncate px-4 py-2.5 text-left text-sm font-medium hover:text-brand">
                          {p.title}
                        </button>
                        <button
                          type="button"
                          onClick={() => storeSaved(savedPlans.filter((x) => x.id !== p.id))}
                          className="grid size-7 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
                          aria-label={`Delete saved plan ${p.title}`}
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Everything below is what the assistant fills in; it's here to check or do by hand. */}
              <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground">
                <span className="h-px flex-1 bg-border" aria-hidden />
                Or plan it yourself
                <span className="h-px flex-1 bg-border" aria-hidden />
              </div>

              {stops.length > 0 && (
                <section aria-labelledby="stops-heading">
                  <div className="flex items-start justify-between gap-3">
                    <h2 id="stops-heading" className="text-sm font-semibold">Your day so far</h2>
                    <span className="shrink-0 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand tabular-nums">{stops.length}/{MAX_STOPS} stops</span>
                  </div>
                  <ul className="mt-3 divide-y divide-border rounded-2xl border border-border bg-card">
                    {stops.map((s) => {
                      const a = s.attractionId ? ATTRACTION_BY_ID.get(s.attractionId) : undefined;
                      const options = VISIT_OPTIONS.includes(s.visitMin) ? VISIT_OPTIONS : [...VISIT_OPTIONS, s.visitMin].sort((x, y) => x - y);
                      return (
                        <li key={s.key} className="flex items-center gap-3 px-4 py-2.5">
                          <span className="size-2 shrink-0 rounded-full" style={{ background: a ? KIND_COLOR[a.kind] : "var(--muted-foreground)" }} aria-hidden />
                          <button type="button" onClick={() => inspectStop(s)} aria-haspopup="dialog" className="min-w-0 flex-1 truncate text-left text-sm font-medium hover:text-brand">
                            {s.name}
                          </button>
                          {s.fixedStartMin != null ? (
                            <span className="inline-flex items-center gap-1 rounded-lg bg-brand-soft py-0.5 pr-0.5 pl-1.5 text-xs text-brand">
                              <Clock className="size-3" aria-hidden />
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
                                className="w-[5.5rem] bg-transparent tabular-nums outline-none"
                              />
                              <button type="button" onClick={() => setFixed(s.key, null)} aria-label={`Clear the set time for ${s.name}`} className="grid size-5 place-items-center rounded hover:bg-brand/15">
                                <X className="size-3" aria-hidden />
                              </button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setFixed(s.key, Math.max(settings.startMin, 12 * 60))}
                              title="Must start at a set time (a booking, a show)"
                              aria-label={`Set a start time for ${s.name}`}
                              className="grid size-7 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
                            >
                              <Clock className="size-3.5" aria-hidden />
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
                            className="rounded-lg border border-border bg-background px-2 py-1 text-xs tabular-nums"
                          >
                            {options.map((m) => (
                              <option key={m} value={m}>
                                {duration(m)}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => setStops((list) => list.filter((x) => x.key !== s.key))}
                            className="grid size-7 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
                            aria-label={`Remove ${s.name}`}
                          >
                            <X className="size-4" aria-hidden />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><Clock className="size-3.5" aria-hidden /> About {duration(stops.reduce((s, x) => s + x.visitMin, 0))} at places, plus travel and breaks</p>
                </section>
              )}

              {/* Trip details: a one-line summary of what's set, opened to change it. */}
              <section aria-labelledby="details-heading" className="rounded-2xl border border-border bg-card">
                <button type="button" aria-expanded={showSettings} aria-controls="trip-details" onClick={() => setShowSettings((v) => !v)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
                    <SlidersHorizontal className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span id="details-heading" className="block text-sm font-semibold">Trip details</span>
                    <span className="block text-xs leading-relaxed text-muted-foreground">
                      {tripSummary}
                    </span>
                  </span>
                  <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition ${showSettings ? "rotate-180" : ""}`} aria-hidden />
                </button>
                {showSettings && (
                  <div id="trip-details" className="space-y-5 border-t border-border px-4 pt-4 pb-5">
                    <div className="space-y-3">
                      <label className="flex items-center gap-3 text-sm"><CalendarDays className="size-4 text-muted-foreground" aria-hidden /><span className="w-14 text-xs text-muted-foreground">Visit</span><input type="date" value={settings.date} min={nycToday()} onChange={(e) => e.target.value && set("date", e.target.value)} className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-sm" /></label>
                      <div className="flex items-center gap-3"><Footprints className="size-4 text-muted-foreground" aria-hidden /><span className="w-14 text-xs text-muted-foreground">Getting around</span><Segmented label="Getting around" value={settings.mode} onChange={(v) => set("mode", v)} options={(Object.keys(MODE_LABEL) as TravelMode[]).map((m) => ({ value: m, label: MODE_LABEL[m] }))} className="min-w-0 flex-1 overflow-x-auto" /></div>
                      <div className="flex items-center gap-3"><MapPin className="size-4 text-muted-foreground" aria-hidden /><span className="w-14 text-xs text-muted-foreground">Crowds</span><Segmented label="Crowds" value={settings.crowd} onChange={(v) => set("crowd", v)} options={[{ value: "avoid", label: "Avoid" }, { value: "balanced", label: "Balance" }, { value: "ignore", label: "Okay" }]} className="min-w-0 flex-1 overflow-x-auto" /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs"><label className="flex flex-col gap-1 text-muted-foreground">Start time<input type="time" value={toHHMM(settings.startMin)} onChange={(e) => { const m = toMinutes(e.target.value); if (m !== null) set("startMin", m); }} className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground" /></label><label className="flex flex-col gap-1 text-muted-foreground">Wrap up<input type="time" value={toHHMM(settings.endMin)} onChange={(e) => { const m = toMinutes(e.target.value); if (m !== null) set("endMin", m <= settings.startMin ? m + 1440 : m); }} className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground" /></label></div>
                    <div className="space-y-2"><span className="text-xs text-muted-foreground">Food breaks</span><div className="flex gap-2">{(["lunch", "dinner"] as const).map((m) => <label key={m} className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm"><input type="checkbox" checked={settings.meals[m]} onChange={(e) => set("meals", { ...settings.meals, [m]: e.target.checked })} className="size-4 accent-(--brand)" />{m === "lunch" ? "Lunch" : "Dinner"}</label>)}</div><p className="text-[11px] text-muted-foreground">Roam finds a good time and nearby food for your route.</p></div>
                    <div className="space-y-2"><span className="text-xs text-muted-foreground">Start from</span>{settings.origin ? <div className="flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-2 rounded-full border border-border bg-background py-1.5 pr-1.5 pl-3 text-sm"><Home className="size-3.5 text-brand" aria-hidden />{settings.origin.label}<button type="button" onClick={() => set("origin", null)} className="grid size-6 place-items-center rounded-full hover:bg-muted" aria-label="Clear starting point"><X className="size-3.5" aria-hidden /></button></span><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.returnToOrigin} onChange={(e) => set("returnToOrigin", e.target.checked)} className="size-4 accent-(--brand)" />Return here</label></div> : <form suppressHydrationWarning className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void setOrigin(); }}><input suppressHydrationWarning value={originText} onChange={(e) => { setOriginText(e.target.value); setOriginError(null); }} placeholder="Hotel, address or neighborhood" aria-label="Starting point" className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand" /><Button type="submit" variant="outline" disabled={originBusy || originText.trim().length < 2}>{originBusy ? <Loader2 className="animate-spin" aria-hidden /> : "Set"}</Button></form>}{originError && <p className="text-sm text-sev-c">{originError}</p>}</div>
                    <ProfileCard profile={profile} onChange={updateProfile} />
                  </div>
                )}
              </section>

              {/* Catalog */}
              <section aria-labelledby="add-heading">
                <h2 id="add-heading" className="text-sm font-semibold">
                  Browse places
                </h2>
                <p className="mt-0.5 mb-3 text-xs text-muted-foreground">Add them here, or tap a dot on the map.</p>
                <StopPicker
                  stops={stops}
                  suggestions={suggestions}
                  onAdd={addStop}
                  onToggle={toggleAttraction}
                  onInspect={inspectAttraction}
                  full={full}
                />
              </section>
            </div>
          )}
        </div>

        {showingPlan ? (
          <div ref={setComposerEl} className="sticky bottom-0 z-30 border-t border-border bg-background/90 px-5 py-3 backdrop-blur-xl" />
        ) : (
          (stops.length > 0 || planError) && (
            <div className="sticky bottom-0 z-30 border-t border-border bg-background/90 px-5 py-4 backdrop-blur-xl">
              {planError && (
                <p role="alert" className="mb-2 text-sm text-sev-c">
                  {planError}
                </p>
              )}
              <Button
                onClick={() => {
                  // Planning from the builder finds the best order again.
                  const next = { ...settings, keepOrder: false };
                  setSettings(next);
                  void runPlan(stops, next);
                }}
                disabled={planning || stops.length === 0}
                className="h-12 w-full rounded-full bg-foreground text-[15px] font-semibold text-background hover:bg-foreground/90"
              >
                {planning ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
                {planning ? "Finding the best order…" : stops.length ? `Plan my day · ${stops.length} stop${stops.length > 1 ? "s" : ""}` : "Add a stop to start"}
                {!planning && stops.length > 0 && <ArrowRight className="size-5" aria-hidden />}
              </Button>
            </div>
          )
        )}
      </aside>

      <div
        role="separator"
        aria-label="Resize map and itinerary panel"
        aria-orientation="vertical"
        aria-valuemin={360}
        aria-valuemax={720}
        aria-valuenow={panelWidth}
        tabIndex={0}
        onPointerDown={(e) => {
          resizeStart.current = { x: e.clientX, width: panelWidth };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!resizeStart.current) return;
          setPanelWidth(Math.max(360, Math.min(720, resizeStart.current.width + e.clientX - resizeStart.current.x)));
        }}
        onPointerUp={() => { resizeStart.current = null; }}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            e.preventDefault();
            setPanelWidth((width) => Math.max(360, Math.min(720, width + (e.key === "ArrowRight" ? 24 : -24))));
          }
        }}
        className="group hidden w-3 shrink-0 cursor-col-resize items-center justify-center bg-background transition hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-brand lg:order-2 lg:flex"
      >
        <span className="h-12 w-1 rounded-full bg-border transition group-hover:h-16 group-hover:bg-brand" />
      </div>

      <div className="fixed top-3 left-3 z-30 rounded-full bg-card/90 py-1.5 pr-4 pl-1.5 shadow-lg ring-1 ring-foreground/5 backdrop-blur-md lg:hidden">
        <Logo />
      </div>
      <div className="relative order-1 shrink-0 max-lg:fixed max-lg:inset-0 lg:order-3 lg:h-dvh lg:flex-1">
        <PlanMap
          stops={mapStops}
          origin={mapOrigin}
          legs={mapLegs}
          chosen={chosen}
          activeKey={activeKey}
          onPickAttraction={onPickAttraction}
          onPickStop={onPickStop}
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
          focus={inspect ? { key: inspect.key, lat: inspect.lat, lon: inspect.lon } : null}
          className="size-full"
        />
        {!showingPlan && (
          <p className="pointer-events-none absolute top-3 left-3 rounded-full bg-card/90 max-lg:hidden px-3 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur">
            Tap a dot for photos, hours and crowds
          </p>
        )}
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
    </div>
  );
}
