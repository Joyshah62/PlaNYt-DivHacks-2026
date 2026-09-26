import { ATTRACTION_BY_ID } from "./attractions";
import { mapsPoint } from "./maps";
import { isMealBreak } from "./profile";
import { clock } from "./time";
import type { DayPlan } from "./types";

/**
 * The day as an iCalendar file: one event per stop, in New York time, with
 * directions in each. Calendar apps read TZID=America/New_York without an
 * embedded VTIMEZONE, so the file stays small.
 */

const escape = (text: string) => text.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

/** RFC 5545 lines are at most 75 octets; longer ones continue with a leading space. */
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    out.push(rest.slice(0, 74));
    rest = ` ${rest.slice(74)}`;
  }
  out.push(rest);
  return out.join("\r\n");
}

function stamp(date: string, min: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCMinutes(Math.round(min));
  const iso = d.toISOString();
  return `${iso.slice(0, 4)}${iso.slice(5, 7)}${iso.slice(8, 10)}T${iso.slice(11, 13)}${iso.slice(14, 16)}00`;
}

export function planToIcs(plan: DayPlan, link: string): string {
  const { date } = plan.request;
  const now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Roam NYC//Day planner//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  plan.stops.forEach((s, i) => {
    const place = s.attractionId ? ATTRACTION_BY_ID.get(s.attractionId) : undefined;
    const directions = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapsPoint(s).query)}&travelmode=transit`;
    const description = [
      place?.blurb,
      s.meal ? `Your ${s.meal}.` : null,
      s.leg ? `Leave the previous stop by ${clock(s.arriveMin - s.leg.minutes)}.` : null,
      `Directions: ${directions}`,
      `Your whole day: ${link}`,
    ]
      .filter(Boolean)
      .join("\n");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${date}-${i}-${s.key}@roam.nyc`,
      `DTSTAMP:${now}`,
      `DTSTART;TZID=America/New_York:${stamp(date, s.startMin)}`,
      `DTEND;TZID=America/New_York:${stamp(date, s.endMin)}`,
      fold(`SUMMARY:${escape(s.name)}`),
      ...(isMealBreak(s) ? [] : [fold(`LOCATION:${escape(place ? `${place.name}, ${place.area}, New York, NY` : `${s.lat.toFixed(5)},${s.lon.toFixed(5)}`)}`)]),
      `GEO:${s.lat.toFixed(5)};${s.lon.toFixed(5)}`,
      fold(`DESCRIPTION:${escape(description)}`),
      "END:VEVENT",
    );
  });
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
