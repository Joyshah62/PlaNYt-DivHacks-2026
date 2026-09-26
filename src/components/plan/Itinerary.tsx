"use client";

import {
  AlarmClock,
  AlertTriangle,
  Bike,
  Bookmark,
  BookmarkCheck,
  CalendarPlus,
  Car,
  Clock,
  ExternalLink,
  Footprints,
  Hourglass,
  Lightbulb,
  Link2,
  Map as MapIcon,
  Pencil,
  TrainFront,
  Users,
  Umbrella,
  UtensilsCrossed,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ATTRACTION_BY_ID } from "@/lib/plan/attractions";
import { crowdBand } from "@/lib/plan/crowd";
import { isMealBreak } from "@/lib/plan/profile";
import { CROWD_COLOR, CROWD_LABEL, KIND_COLOR, LEG_VERB, MODE_LABEL } from "@/lib/plan/display";
import { clock, duration, nycToday, WEEKDAYS } from "@/lib/plan/time";
import { mapsDayRoute, mapsDirections, mapsPoint, type MapsPoint } from "@/lib/plan/maps";
import type { DayPlan, Leg, LegMode, PlannedStop, StopInput } from "@/lib/plan/types";
import { WEATHER_LABEL, weatherKind, type Forecast } from "@/lib/plan/weatherCodes";
import { WeatherIcon } from "./WeatherIcon";
import { stopFromAttraction } from "./StopPicker";
import { cn } from "@/lib/utils";
import { CrowdStrip } from "./CrowdStrip";

const LEG_ICON: Record<LegMode, typeof Footprints> = { walk: Footprints, subway: TrainFront, bike: Bike, car: Car };
/** Places where rain changes the visit. */
const OUTDOOR = new Set(["view", "park", "landmark", "neighborhood"]);

/** "in 12 days", "tomorrow", "today". */
function countdown(date: string): string | null {
  const days = Math.round((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${nycToday()}T12:00:00Z`)) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 14) return `In ${days} days`;
  return `In ${Math.round(days / 7)} weeks`;
}

/** Up to three of the day's photos, as the header's backdrop. */
function Mosaic({ photos }: { photos: string[] }) {
  if (!photos.length) {
    return <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_0%_0%,var(--brand)_0%,oklch(0.3_0.1_280)_55%,oklch(0.18_0.03_260)_100%)]" aria-hidden />;
  }
  return (
    <div className={cn("absolute inset-0 grid gap-0.5", photos.length === 1 ? "grid-cols-1" : "grid-cols-[1.6fr_1fr]", photos.length === 3 && "grid-rows-2")} aria-hidden>
      {photos.map((url, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={url}
          src={url}
          alt=""
          className={cn("hero-kenburns size-full object-cover", photos.length === 3 && i === 0 && "row-span-2")}
          style={{ animationDelay: `${i * -6}s` }}
        />
      ))}
    </div>
  );
}


const mapsFoodNearby = (s: PlannedStop) =>
  `https://www.google.com/maps/search/?${new URLSearchParams({ api: "1", query: `restaurants near ${s.lat.toFixed(5)},${s.lon.toFixed(5)}` })}`;

interface LegEnds {
  from: MapsPoint;
  to: MapsPoint & { name: string };
}

/**
 * One leg, and a link that opens it in Google Maps. Google has live transit
 * times, service changes and turn-by-turn, which our estimates can't match.
 */
function LegRow({ leg, ends }: { leg: Leg; ends: LegEnds }) {
  const Icon = LEG_ICON[leg.mode];
  return (
    <li className="flex items-center gap-3 py-2 pl-[3px] text-sm text-muted-foreground">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted">
        <Icon className="size-3.5" aria-hidden />
      </span>
      <span className="flex-1 leading-snug">
        <span className="font-medium text-foreground tabular-nums">
          {leg.estimated ? "~" : ""}
          {duration(leg.minutes)}
        </span>{" "}
        {LEG_VERB[leg.mode]}
      </span>
      <a
        href={mapsDirections(ends.from, ends.to, leg.mode)}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-brand transition hover:bg-brand-soft"
      >
        Directions<span className="sr-only"> to {ends.to.name} in Google Maps</span>
        <ExternalLink className="size-3" aria-hidden />
      </a>
    </li>
  );
}

export function Itinerary({
  plan,
  activeKey,
  isSaved,
  shareNote,
  onActivate,
  onInspect,
  onEdit,
  onSave,
  onShare,
  onCalendar,
  assistant,
  choices,
  dayPicker,
  forecast,
  photos,
}: {
  plan: DayPlan;
  activeKey: string | null;
  isSaved: boolean;
  shareNote: string | null;
  onActivate: (key: string | null) => void;
  onInspect: (stop: StopInput) => void;
  onEdit: () => void;
  onSave: () => void;
  onShare: () => void;
  onCalendar: () => void;
  /** The trip assistant, right under the day's summary and actions. */
  assistant?: ReactNode;
  /** Options for the day's open slots, shown under the summary. */
  choices?: ReactNode;
  /** The strip for choosing which day to go. */
  dayPicker?: ReactNode;
  forecast: Forecast | null;
  /** Photo URL by stop key. */
  photos: Record<string, string>;
}) {
  const { summary, baseline, request } = plan;
  const savedMin = baseline ? baseline.travelMin - summary.travelMin : 0;
  const dayRoute = mapsDayRoute(plan);
  const fromHour = Math.max(6, Math.floor(request.startMin / 60) - 1);
  const toHour = Math.min(24, Math.max(fromHour + 6, Math.ceil(Math.max(summary.finishMin, request.endMin) / 60)));
  const band = summary.crowdLevel === null ? null : crowdBand(summary.crowdLevel);
  const isToday = request.date === nycToday();
  const until = isToday ? null : countdown(request.date);
  const dayWeather = forecast?.days.find((d) => d.date === request.date) ?? null;
  const hourly = forecast?.hours[request.date] ?? null;
  const placeCount = plan.stops.filter((s) => !isMealBreak(s)).length;
  const heroPhotos = [...new Set(plan.stops.flatMap((s) => (photos[s.key] ? [photos[s.key]] : [])))].slice(0, 3);

  return (
    <div className="animate-rise">
      {/* The day at a glance, over its own photos. */}
      <header className="relative -mx-5 -mt-5 h-[clamp(14rem,34dvh,18rem)] overflow-hidden text-white">
        <Mosaic photos={heroPhotos} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10" aria-hidden />
        <Button variant="outline" size="sm" className="absolute top-4 right-4 rounded-full border-white/30 bg-black/30 text-white backdrop-blur-md hover:bg-black/50 hover:text-white" onClick={onEdit}>
          <Pencil aria-hidden /> Edit
        </Button>
        {until && (
          <span className="absolute top-4 left-5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold tracking-wide uppercase backdrop-blur-md">{until}</span>
        )}
        <div className="absolute inset-x-5 bottom-5">
          <p className="text-xs font-semibold tracking-[0.14em] text-white/75 uppercase">
            {WEEKDAYS[plan.dow]} · {new Date(`${request.date}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" })}
          </p>
          <h2 className="mt-1.5 font-display text-5xl leading-none tracking-tight drop-shadow-sm">
            {clock(plan.stops[0]?.startMin ?? request.startMin)} – {clock(summary.finishMin)}
          </h2>
          <p className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/85">
            <span>
              {placeCount} {placeCount === 1 ? "stop" : "stops"} · {duration(summary.travelMin)} getting around
            </span>
            {dayWeather ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 backdrop-blur-md">
                <WeatherIcon code={dayWeather.code} className="size-3.5 text-white" />
                {WEATHER_LABEL[weatherKind(dayWeather.code)]} · {dayWeather.hi}°/{dayWeather.lo}°
                {dayWeather.rain >= 20 && <span className="text-white/75">· {dayWeather.rain}% rain</span>}
              </span>
            ) : (
              forecast && <span className="text-white/70">Forecast opens ~16 days out</span>
            )}
          </p>
        </div>
      </header>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={onSave} className={cn("neo-control rounded-full", isSaved ? "neo-inset text-brand font-semibold" : "")}>
          {isSaved ? <BookmarkCheck aria-hidden /> : <Bookmark aria-hidden />}
          {isSaved ? "Saved" : "Save plan"}
        </Button>
        <Button size="sm" variant="outline" onClick={onCalendar} className="neo-control rounded-full">
          <CalendarPlus aria-hidden /> Add to calendar
        </Button>
        <Button size="sm" variant="outline" onClick={onShare} className="neo-control rounded-full">
          <Link2 aria-hidden /> Copy link
        </Button>
        {dayRoute && (
          <a
            href={dayRoute}
            target="_blank"
            rel="noreferrer"
            className="neo-control inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[0.8rem] font-medium"
          >
            <MapIcon className="size-3.5" aria-hidden /> Google Maps
          </a>
        )}
        <span role="status" aria-live="polite" className="text-xs text-muted-foreground">
          {shareNote}
        </span>
      </div>

      {assistant}

      {dayPicker}

      <dl className="mt-5 grid grid-cols-3 gap-2.5">
        <div className="neo-raised rounded-2xl p-3">
          <dt className="text-xs text-muted-foreground">Travel</dt>
          <dd className="mt-0.5 font-display text-2xl leading-tight">{duration(summary.travelMin)}</dd>
          <dd className="text-[11px] text-muted-foreground">{MODE_LABEL[request.mode]}</dd>
        </div>
        <div className="neo-raised rounded-2xl p-3">
          <dt className="text-xs text-muted-foreground">Saved</dt>
          <dd className="mt-0.5 font-display text-2xl leading-tight text-brand">{savedMin > 0 ? duration(savedMin) : "—"}</dd>
          <dd className="text-[11px] text-muted-foreground">vs. your order</dd>
        </div>
        <div className="neo-raised rounded-2xl p-3">
          <dt className="text-xs text-muted-foreground">Crowds</dt>
          <dd className="mt-0.5 flex items-center gap-1.5 font-display text-2xl leading-tight">
            {band ? (
              <>
                <span className="size-2.5 rounded-full" style={{ background: CROWD_COLOR[band] }} aria-hidden />
                {CROWD_LABEL[band].replace(" time", "")}
              </>
            ) : (
              "—"
            )}
          </dd>
          <dd className="text-[11px] text-muted-foreground">on average</dd>
        </div>
      </dl>

      {choices}

      {plan.insights.length > 0 && (
        <ul className="neo-raised mt-5 space-y-2 rounded-2xl p-4 text-sm leading-relaxed border-brand/20">
          {plan.insights.map((line) => (
            <li key={line} className="flex gap-2.5">
              <Lightbulb className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      )}

      {plan.skipped.length > 0 && (
        <p className="mt-3 text-sm text-muted-foreground">
          Left out: {plan.skipped.map((s) => `${s.name} (${s.reason.toLowerCase()})`).join(", ")}
        </p>
      )}

      <ol className="mt-6 space-y-1" aria-label="Your day, in order">
        {plan.stops.map((s, i) => {
          const attraction = s.attractionId ? ATTRACTION_BY_ID.get(s.attractionId) : undefined;
          const active = s.key === activeKey;
          const prevPlace = plan.stops.slice(0, i).reverse().find((x) => !isMealBreak(x)) ?? null;
          if (isMealBreak(s)) {
            const food = s.nearbyFood ? ATTRACTION_BY_ID.get(s.nearbyFood.id) : undefined;
            return (
              <li key={s.key} className="py-2">
                <div className="neo-inset flex items-start gap-3 rounded-2xl px-4 py-3.5">
                  <span className="neo-control grid size-8 shrink-0 place-items-center rounded-full text-sev-b">
                    <UtensilsCrossed className="size-3.5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="text-xs font-medium text-muted-foreground tabular-nums">
                      {clock(s.startMin)} – {clock(s.endMin)} · {duration(s.visitMin)}
                    </p>
                    <h3 className="font-semibold">
                      {s.name}
                      {prevPlace ? <span className="font-normal text-muted-foreground"> near {prevPlace.name}</span> : null}
                    </h3>
                    {food && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Close by:{" "}
                        <button type="button" onClick={() => onInspect(stopFromAttraction(food))} className="font-medium text-foreground underline-offset-2 hover:underline">
                          {food.name}
                        </button>
                      </p>
                    )}
                  </div>
                  <a href={mapsFoodNearby(s)} target="_blank" rel="noreferrer" className="neo-control inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold text-brand">
                    Find food <ExternalLink className="size-3" aria-hidden />
                  </a>
                </div>
              </li>
            );
          }
          const number = plan.stops.slice(0, i + 1).filter((x) => !isMealBreak(x)).length;
          const weather = hourly?.[Math.floor(s.startMin / 60) % 24] ?? null;
          const wet = weather && weather.rain >= 40 && attraction && OUTDOOR.has(attraction.kind);
          return (
            <li key={s.key}>
              <ol>
                {s.leg && (
                  <LegRow
                    leg={s.leg}
                    ends={{ from: prevPlace ? mapsPoint(prevPlace) : mapsPoint(request.origin!), to: { ...mapsPoint(s), name: s.name } }}
                  />
                )}
                <li>
                  {/* The whole card is a pointer target; the name is the keyboard one. */}
                  <div
                    data-stop={s.key}
                    onClick={() => {
                      onActivate(s.key);
                      onInspect(s);
                    }}
                    onMouseEnter={() => onActivate(s.key)}
                    className={cn(
                      "group neo-raised w-full cursor-pointer overflow-hidden rounded-2xl text-left transition-all duration-300",
                      active ? "ring-2 ring-brand border-brand/50 shadow-lg scale-[1.01]" : "hover:-translate-y-0.5 hover:shadow-md",
                    )}
                  >
                    {photos[s.key] && (
                      <div className="relative h-36 overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photos[s.key]} alt="" loading="lazy" className="size-full object-cover transition duration-700 group-hover:scale-105" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" aria-hidden />
                        <span className="absolute bottom-3 left-4 font-display text-2xl leading-none text-white tabular-nums drop-shadow">{clock(s.startMin)}</span>
                        {weather && (
                          <span className="absolute right-3 bottom-3 inline-flex items-center gap-1 rounded-full bg-black/40 px-2 py-0.5 text-xs text-white backdrop-blur-md">
                            <WeatherIcon code={weather.code} className="size-3.5 text-white" /> {weather.temp}°
                          </span>
                        )}
                      </div>
                    )}
                    <div className="flex items-start gap-3 p-4">
                      <span
                        className={cn(
                          "grid size-7 shrink-0 place-items-center rounded-full text-[13px] font-semibold tabular-nums transition",
                          active ? "neo-primary" : "neo-inset text-brand",
                        )}
                      >
                        {number}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-muted-foreground tabular-nums">
                          {clock(s.startMin)} – {clock(s.endMin)} · {duration(s.visitMin)}
                        </p>
                        <h3 className="mt-0.5 text-[17px] font-semibold leading-snug">
                          <button
                            type="button"
                            aria-haspopup="dialog"
                            onClick={(e) => {
                              e.stopPropagation();
                              onActivate(s.key);
                              onInspect(s);
                            }}
                            className="text-left outline-none focus-visible:underline"
                          >
                            {s.name}
                          </button>
                        </h3>
                        {attraction && (
                          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <span className="size-2 rounded-full" style={{ background: KIND_COLOR[attraction.kind] }} aria-hidden />
                            {attraction.area}
                          </p>
                        )}
                        {s.waitMin > 0 && (
                          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Hourglass className="size-3.5" aria-hidden /> Arrive {clock(s.arriveMin)},{" "}
                            {s.fixedStartMin != null && s.startMin === s.fixedStartMin ? `${duration(s.waitMin)} before your ${clock(s.startMin)} time` : `doors open ${clock(s.startMin)}`}
                          </p>
                        )}
                        {(s.fixedStartMin != null || (s.meal && !isMealBreak(s))) && (
                          <p className="mt-1.5 flex flex-wrap gap-1.5">
                            {s.fixedStartMin != null && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-brand">
                                <AlarmClock className="size-3" aria-hidden /> Set for {clock(s.fixedStartMin)}
                              </span>
                            )}
                            {s.meal && !isMealBreak(s) && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-sev-b-soft px-2 py-0.5 text-[11px] font-medium text-sev-b">
                                <UtensilsCrossed className="size-3" aria-hidden /> Your {s.meal}
                              </span>
                            )}
                          </p>
                        )}
                        {s.issue && (
                          <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-sev-c-soft px-2.5 py-1.5 text-xs font-medium text-sev-c">
                            <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
                            {s.issue === "closed"
                              ? `Usually closed on ${WEEKDAYS[plan.dow]}s`
                              : s.issue === "late"
                                ? `You'd arrive at ${clock(s.arriveMin)}, after the ${clock(s.fixedStartMin ?? s.startMin)} start`
                                : `Closes at ${clock((s.window as [number, number])[1])}, before this visit ends`}
                          </p>
                        )}
                        {wet && (
                          <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-sev-a-soft px-2.5 py-1.5 text-xs font-medium text-sev-a">
                            <Umbrella className="size-3.5 shrink-0" aria-hidden /> {weather!.rain}% chance of rain around {clock(s.startMin)}. Bring an umbrella.
                          </p>
                        )}
                        {!photos[s.key] && weather && (
                          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <WeatherIcon code={weather.code} className="size-3.5" /> {weather.temp}° at {clock(s.startMin)}
                          </p>
                        )}
                        {s.window && s.window !== "always" && !s.issue && (
                          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Clock className="size-3.5" aria-hidden /> Typically open {clock(s.window[0])} – {clock(s.window[1])}
                          </p>
                        )}
                      </div>
                    </div>
                    {s.crowd && (
                      <div className="px-4 pb-4">
                        <p className="mb-1.5 flex items-center gap-1.5 text-xs">
                          <Users className="size-3.5 text-muted-foreground" aria-hidden />
                          <span className="font-medium" style={{ color: CROWD_COLOR[s.crowd.band] }}>
                            {CROWD_LABEL[s.crowd.band]}
                          </span>
                          <span className="truncate text-muted-foreground">· area around {s.crowd.station}</span>
                        </p>
                        <CrowdStrip levels={s.crowd.levels} visitStart={s.startMin} visitEnd={s.endMin} fromHour={fromHour} toHour={toHour} />
                      </div>
                    )}
                  </div>
                </li>
              </ol>
            </li>
          );
        })}
        {plan.returnLeg && request.origin && (
          <li>
            <ol>
              <LegRow
                leg={plan.returnLeg}
                ends={{ from: mapsPoint(plan.stops[plan.stops.length - 1]), to: { ...mapsPoint(request.origin), name: request.origin.label } }}
              />
              <li className="flex items-center gap-3 rounded-2xl border border-dashed border-border px-4 py-3 text-sm">
                <span className="text-muted-foreground">Back at</span>
                <span className="font-medium">{request.origin.label}</span>
                <span className="ml-auto text-muted-foreground tabular-nums">{clock(summary.finishMin)}</span>
              </li>
            </ol>
          </li>
        )}
      </ol>

      <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
        Crowd levels are area busyness from MTA subway ridership near each stop ({plan.crowdSource.weeks.length} recent weeks, typical {WEEKDAYS[plan.dow]}),
        compared with that area&apos;s busiest hour of the day. They describe the streets around a place, not the line inside it. Hours are typical;
        check before you go. Routes: {plan.routing.ok ? "OSRM on OpenStreetMap" : "straight-line estimates (routing was unavailable)"}; times marked ~ are estimates.
      </p>
    </div>
  );
}
