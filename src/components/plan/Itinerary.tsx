"use client";

import { AlarmClock, AlertTriangle, Bike, Bookmark, BookmarkCheck, CalendarPlus, Car, CarTaxiFront, ChevronDown, Footprints, Hourglass, Lightbulb, Link2, Map as MapIcon, MapPin, MessageCircle, Pencil, Share2, TrainFront, Umbrella, Users, UtensilsCrossed, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ATTRACTION_BY_ID } from "@/lib/plan/attractions";
import { crowdBand } from "@/lib/plan/crowdBand";
import { isMealBreak } from "@/lib/plan/profile";
import { LiveAlerts } from "./LiveAlerts";
import { CROWD_LABEL, LEG_VERB, MODE_LABEL } from "@/lib/plan/display";
import { clock, duration, nycToday, WEEKDAYS } from "@/lib/plan/time";
import { mapsDayRoute, mapsDirections, mapsPoint, type MapsPoint } from "@/lib/plan/maps";
import type { DayPlan, Leg, LegMode, PlannedStop, StopInput } from "@/lib/plan/types";
import { WEATHER_LABEL, weatherKind, type Forecast } from "@/lib/plan/weatherCodes";
import { WeatherIcon } from "./WeatherIcon";
import { stopFromAttraction } from "./StopPicker";
import { Fold } from "./Fold";
import { arrowKeys } from "./arrowKeys";
import { canShareNatively } from "@/lib/plan/shareLink";

const LEG_ICON: Record<LegMode, typeof Footprints> = { walk: Footprints, subway: TrainFront, bike: Bike, car: Car, taxi: CarTaxiFront };
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
    <li className="pl-tl pl-leg" data-mode={leg.mode}>
      <span className="pl-rail">
        <span className="pl-leg-icon">
          <Icon aria-hidden />
        </span>
      </span>
      <span className="pl-leg-body">
        <span className="pl-mono">
          {leg.estimated ? "~" : ""}
          {duration(leg.minutes)} {LEG_VERB[leg.mode]}
        </span>
        <a href={mapsDirections(ends.from, ends.to, leg.mode)} target="_blank" rel="noreferrer" className="pl-link">
          Directions<span className="sr-only"> to {ends.to.name} in Google Maps</span> ↗
        </a>
      </span>
    </li>
  );
}

/** Up to three of the day's photos, as its cover. */
function Mosaic({ photos }: { photos: string[] }) {
  if (!photos.length) return null;
  return (
    <div className={`pl-mosaic n${photos.length}`} aria-hidden>
      {photos.map((url, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={url} src={url} alt="" referrerPolicy="no-referrer" style={{ animationDelay: `${i * -7}s` }} />
      ))}
    </div>
  );
}

/** Copy link, calendar and Google Maps, behind one Share button. */
function ShareMenu({ onShare, onNativeShare, onCalendar, dayRoute }: { onShare: () => void; onNativeShare?: () => void; onCalendar: () => void; dayRoute: string | null }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    // Open: focus the first item. Escape: back to the Share button.
    list.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onDown = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const pick = (fn: () => void) => () => {
    fn();
    setOpen(false);
  };
  return (
    <div ref={root} className="pl-menu">
      <button ref={button} type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="pl-textbtn">
        <Share2 aria-hidden /> Share <ChevronDown aria-hidden />
      </button>
      {open && (
        <div role="menu" aria-label="Share this day" className="pl-menu-list" ref={list} onKeyDown={(e) => arrowKeys(e, '[role="menuitem"]', false)}>
          {/* Phones: their own share sheet (Messages, WhatsApp…), which also has Copy. */}
          {onNativeShare && canShareNatively() && (
            <button type="button" role="menuitem" onClick={pick(onNativeShare)}>
              <Share2 aria-hidden /> Send link…
            </button>
          )}
          <button type="button" role="menuitem" onClick={pick(onShare)}>
            <Link2 aria-hidden /> Copy link
          </button>
          <button type="button" role="menuitem" onClick={pick(onCalendar)}>
            <CalendarPlus aria-hidden /> Add to calendar
          </button>
          {dayRoute && (
            <a role="menuitem" href={dayRoute} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}>
              <MapIcon aria-hidden /> Open in Google Maps ↗
            </a>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The planned day, in the order you read it: the cover (when, how long, the weather), what to do
 * with it (save, share), the numbers, the stops themselves, then what you could change.
 */
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
  onNativeShare,
  onCalendar,
  onAsk,
  note,
  onDismissNote,
  phone,
  budget,
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
  /** Sends the link through the phone's share sheet. */
  onNativeShare?: () => void;
  onCalendar: () => void;
  /** Opens the trip assistant: the main way to change the day. */
  onAsk: () => void;
  /** What Roam AI said about the day it just built, and anything it couldn't find. */
  note?: { reply: string; unresolved: string[] } | null;
  onDismissNote?: () => void;
  /** Sends the planned day by text. */
  phone?: ReactNode;
  /** Optional cost estimate, fetched only when opened. */
  budget?: ReactNode;
  /** Options for the day's open slots ("Your call"). */
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
  const band = summary.crowdLevel === null ? null : crowdBand(summary.crowdLevel);
  const isToday = request.date === nycToday();
  const until = isToday ? null : countdown(request.date);
  const dayWeather = forecast?.days.find((d) => d.date === request.date) ?? null;
  const hourly = forecast?.hours[request.date] ?? null;
  const placeCount = plan.stops.filter((s) => !isMealBreak(s)).length;
  const coverPhotos = [...new Set(plan.stops.flatMap((s) => (photos[s.key] ? [photos[s.key]] : [])))].slice(0, 3);

  return (
    <div className="animate-rise">
      <header className="pl-cover">
        <Mosaic photos={coverPhotos} />
        {until && <span className="pl-cover-badge pl-mono">{until}</span>}
        <div className="pl-cover-text">
          <p className="pl-mono pl-kicker">
            {WEEKDAYS[plan.dow]} · {new Date(`${request.date}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" })}
          </p>
          <h2 className="pl-cover-time">
            {clock(plan.stops[0]?.startMin ?? request.startMin)} <em>to</em> {clock(summary.finishMin)}
          </h2>
          <p className="pl-cover-dek">
            <span>
              {placeCount} {placeCount === 1 ? "stop" : "stops"}
            </span>
            <span>
              {duration(summary.travelMin)} by {MODE_LABEL[request.mode].toLowerCase()}
            </span>
            {savedMin > 0 && <span>{duration(savedMin)} saved</span>}
            {band && <span>{CROWD_LABEL[band].replace(" time", "")} crowds</span>}
            {dayWeather ? (
              <span>
                <WeatherIcon code={dayWeather.code} /> {WEATHER_LABEL[weatherKind(dayWeather.code)]}, {dayWeather.hi}°/{dayWeather.lo}°{dayWeather.rain >= 20 && `, ${dayWeather.rain}% rain`}
              </span>
            ) : (
              forecast && <span>Forecast opens ~16 days out</span>
            )}
          </p>
        </div>
      </header>

      <LiveAlerts date={request.date} places={plan.stops.filter((s) => !isMealBreak(s)).map((s) => s.name)} />

      {note && (
        <div className="pl-note pl-day-note" role="status">
          <p>{note.reply}</p>
          {note.unresolved.length > 0 && <p className="pl-muted mt-2">Couldn&apos;t find on the map: {note.unresolved.join(", ")}. Ask Roam AI for another, or add it yourself.</p>}
          {onDismissNote && (
            <button type="button" onClick={onDismissNote} aria-label="Dismiss" className="pl-icon pl-day-note-close">
              <X aria-hidden />
            </button>
          )}
        </div>
      )}

      {/* Changing the day is a conversation first; the manual tools sit beside it. */}
      <button type="button" onClick={onAsk} className="ed-btn pl-ask">
        <MessageCircle aria-hidden /> Ask Roam AI to change anything
      </button>

      <div className="pl-actions pl-mono">
        <button type="button" onClick={onSave} className="pl-textbtn" aria-pressed={isSaved}>
          {isSaved ? <BookmarkCheck className="pl-red" aria-hidden /> : <Bookmark aria-hidden />}
          {isSaved ? "Saved" : "Save"}
        </button>
        <ShareMenu onShare={onShare} onNativeShare={onNativeShare} onCalendar={onCalendar} dayRoute={dayRoute} />
        {phone}
        <button type="button" onClick={onEdit} className="pl-textbtn end">
          <Pencil aria-hidden /> Edit stops
        </button>
        <span role="status" aria-live="polite" className="pl-toast">
          {shareNote}
        </span>
      </div>

      {plan.skipped.length > 0 && (
        <p className="pl-flag mt-4">
          <AlertTriangle aria-hidden />
          <span>Left out: {plan.skipped.map((s) => `${s.name} (${s.reason.toLowerCase()})`).join(", ")}</span>
        </p>
      )}

      <ol className="pl-timeline" aria-label="Your day, in order">
        {plan.stops.map((s, i) => {
          const attraction = s.attractionId ? ATTRACTION_BY_ID.get(s.attractionId) : undefined;
          const prevPlace = plan.stops.slice(0, i).reverse().find((x) => !isMealBreak(x)) ?? null;
          const leg = s.leg && <LegRow key={`${s.key}-leg`} leg={s.leg} ends={{ from: prevPlace ? mapsPoint(prevPlace) : mapsPoint(request.origin!), to: { ...mapsPoint(s), name: s.name } }} />;
          if (isMealBreak(s)) {
            const food = s.nearbyFood ? ATTRACTION_BY_ID.get(s.nearbyFood.id) : undefined;
            return [
              leg,
              <li key={s.key} className="pl-tl pl-stop pl-meal" style={{ cursor: "default" }}>
                <span className="pl-rail">
                  <span className="pl-meal-mark">
                    <UtensilsCrossed aria-hidden />
                  </span>
                </span>
                <div className="pl-stop-body">
                  <p className="pl-stop-time pl-mono">
                    {clock(s.startMin)} – {clock(s.endMin)} · {duration(s.visitMin)}
                  </p>
                  <h3 className="pl-stop-name">{s.name}</h3>
                  {prevPlace && <p className="pl-stop-area">near {prevPlace.name}</p>}
                  <p className="pl-notes">
                    <span>
                      {food && (
                        <>
                          Close by:{" "}
                          <button type="button" onClick={() => onInspect(stopFromAttraction(food))} className="pl-link">
                            {food.name}
                          </button>
                          {" · "}
                        </>
                      )}
                      <a href={mapsFoodNearby(s)} target="_blank" rel="noreferrer" className="pl-link">
                        Food nearby on Google Maps ↗
                      </a>
                    </span>
                  </p>
                </div>
              </li>,
            ];
          }
          const number = plan.stops.slice(0, i + 1).filter((x) => !isMealBreak(x)).length;
          const weather = hourly?.[Math.floor(s.startMin / 60) % 24] ?? null;
          const wet = weather && weather.rain >= 40 && attraction && OUTDOOR.has(attraction.kind);
          return [
            leg,
            // The whole entry is a pointer target; the name is the keyboard one.
            <li
              key={s.key}
              data-stop={s.key}
              data-active={s.key === activeKey}
              onClick={() => {
                onActivate(s.key);
                onInspect(s);
              }}
              onMouseEnter={() => onActivate(s.key)}
              className="pl-tl pl-stop"
            >
              <span className="pl-rail">
                <span className="pl-bullet">{number}</span>
              </span>
              <div className="pl-stop-body">
                <p className="pl-stop-time pl-mono">
                  <span>
                    {clock(s.startMin)} – {clock(s.endMin)} · {duration(s.visitMin)}
                  </span>
                  {weather && (
                    <span>
                      <WeatherIcon code={weather.code} /> {weather.temp}°
                    </span>
                  )}
                  {s.crowd && (
                    <span className={s.crowd.band === "busy" || s.crowd.band === "peak" ? "pl-red" : undefined}>
                      <Users aria-hidden /> {CROWD_LABEL[s.crowd.band]}
                    </span>
                  )}
                </p>
                {photos[s.key] && (
                  <div className="pl-photo">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photos[s.key]} alt="" loading="lazy" referrerPolicy="no-referrer" />
                  </div>
                )}
                <h3 className="pl-stop-name">
                  <button
                    type="button"
                    aria-haspopup="dialog"
                    onClick={(e) => {
                      e.stopPropagation();
                      onActivate(s.key);
                      onInspect(s);
                    }}
                  >
                    {s.name}
                  </button>
                </h3>
                {attraction && <p className="pl-stop-area">{attraction.area}</p>}
                <div className="pl-notes">
                  {s.issue && (
                    <p className="red">
                      <AlertTriangle aria-hidden />
                      {s.issue === "closed"
                        ? `Usually closed on ${WEEKDAYS[plan.dow]}s`
                        : s.issue === "late"
                          ? `You'd arrive at ${clock(s.arriveMin)}, after the ${clock(s.fixedStartMin ?? s.startMin)} start`
                          : `Closes at ${clock((s.window as [number, number])[1])}, before this visit ends`}
                    </p>
                  )}
                  {wet && (
                    <p className="red">
                      <Umbrella aria-hidden /> {weather!.rain}% chance of rain around {clock(s.startMin)}. Bring an umbrella.
                    </p>
                  )}
                  {s.fixedStartMin != null && (
                    <p className="red">
                      <AlarmClock aria-hidden /> Set for {clock(s.fixedStartMin)}
                    </p>
                  )}
                  {s.waitMin > 0 && (
                    <p>
                      <Hourglass aria-hidden /> Arrive {clock(s.arriveMin)},{" "}
                      {s.fixedStartMin != null && s.startMin === s.fixedStartMin ? `${duration(s.waitMin)} before your ${clock(s.startMin)} time` : `doors open ${clock(s.startMin)}`}
                    </p>
                  )}
                  {s.meal && !isMealBreak(s) && (
                    <p>
                      <UtensilsCrossed aria-hidden /> Your {s.meal}
                    </p>
                  )}
                </div>
              </div>
            </li>,
          ];
        })}
        {plan.returnLeg && request.origin && (
          <>
            <LegRow leg={plan.returnLeg} ends={{ from: mapsPoint(plan.stops[plan.stops.length - 1]), to: { ...mapsPoint(request.origin), name: request.origin.label } }} />
            <li className="pl-tl">
              <span className="pl-rail">
                <span className="pl-bullet ink">
                  <MapPin className="size-[1.1em]" aria-hidden />
                </span>
              </span>
              <p className="pl-end">
                <span>Back at {request.origin.label}</span>
                <span className="pl-mono ml-auto">{clock(summary.finishMin)}</span>
              </p>
            </li>
          </>
        )}
      </ol>

      {/* The extras, one line each until opened. */}
      <div className="pl-folds">
        {choices}
        {dayPicker}
        {budget && <Fold kicker="Cost of the day" title={<>A day within your <em>budget</em></>} summary="Tickets, food and subway fares, estimated per person.">{budget}</Fold>}
        <Fold kicker="Why this order" title={<>The thinking, <em>briefly</em></>} summary={plan.insights[0] ?? "Where the crowds, hours and travel times come from."}>
          {plan.insights.length > 0 && (
            <ul className="pl-insights">
              {plan.insights.map((line) => (
                <li key={line}>
                  <Lightbulb aria-hidden />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="pl-fine">
            Crowd levels are area busyness from MTA subway ridership near each stop ({plan.crowdSource.weeks.length} recent weeks, typical {WEEKDAYS[plan.dow]}),
            compared with that area&apos;s busiest hour of the day. They describe the streets around a place, not the line inside it. Hours are typical;
            check before you go. Routes: {plan.routing.ok ? "OSRM on OpenStreetMap" : "straight-line estimates (routing was unavailable)"}; times marked ~ are estimates.
          </p>
        </Fold>
      </div>
    </div>
  );
}
