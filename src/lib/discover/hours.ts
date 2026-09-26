import type { OpenWindow, WeeklyHours } from "@/lib/plan/attractions";

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/** One day's window from "11:30-15:00,17:00-22:00": first open to last close, past midnight when it wraps. */
function spanOf(times: string): OpenWindow | null {
  const ranges = times.split(",").map((r) => r.trim().match(/^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\+?$/));
  if (!ranges.length || ranges.some((r) => !r)) return null;
  let open = Infinity;
  let close = -Infinity;
  for (const r of ranges as RegExpMatchArray[]) {
    const o = toMin(r[1]);
    let c = toMin(r[2]);
    if (c <= o) c += 1440;
    open = Math.min(open, o);
    close = Math.max(close, c);
  }
  return [open, close];
}

/** "Mo-Fr" -> [1..5], "Sa,Su" -> [6, 0], "Fr-Mo" wraps. */
function daysOf(spec: string): number[] | null {
  const out: number[] = [];
  for (const part of spec.split(",")) {
    const [a, b] = part.trim().split("-");
    const from = DAYS.indexOf(a);
    const to = b ? DAYS.indexOf(b) : from;
    if (from < 0 || to < 0) return null;
    for (let d = from; ; d = (d + 1) % 7) {
      out.push(d);
      if (d === to) break;
    }
  }
  return out;
}

/**
 * OpenStreetMap's opening_hours for the common shapes: "24/7", "Mo-Su 11:00-22:00",
 * "Mo-Fr 08:00-18:00; Sa 09:00-17:00; Su off". Anything more exotic (public
 * holidays, months, "sunset") returns null: unknown, never a guess.
 */
export function parseOsmHours(text: string | null | undefined): WeeklyHours | null {
  if (!text) return null;
  const t = text.trim();
  if (t === "24/7") return Array(7).fill([0, 1440]);
  const week: WeeklyHours = Array(7).fill(null);
  let any = false;
  for (const rule of t.split(";").map((r) => r.trim()).filter(Boolean)) {
    const m = rule.match(/^([A-Za-z,\- ]+?)\s+(off|closed|[\d:,\-+ ]+)$/);
    const allDays = rule.match(/^([\d:,\-+ ]+)$/);
    if (allDays) {
      const w = spanOf(allDays[1].replace(/\s/g, ""));
      if (!w) return null;
      week.fill(w);
      any = true;
      continue;
    }
    if (!m) return null;
    const days = daysOf(m[1].replace(/\s/g, ""));
    if (!days) return null;
    const w = /^(off|closed)$/.test(m[2]) ? null : spanOf(m[2].replace(/\s/g, ""));
    if (w === null && !/^(off|closed)$/.test(m[2])) return null;
    for (const d of days) week[d] = w;
    any = true;
  }
  return any ? week : null;
}

interface GooglePoint {
  day: number;
  hour: number;
  minute?: number;
}

/** Google's regularOpeningHours.periods (day 0 = Sunday), folded to one window a day. */
export function googleHours(periods: { open: GooglePoint; close?: GooglePoint }[] | undefined): WeeklyHours | null {
  if (!periods?.length) return null;
  // Open all the time: a single period with no close.
  if (periods.length === 1 && !periods[0].close) return Array(7).fill([0, 1440]);
  const week: WeeklyHours = Array(7).fill(null);
  for (const p of periods) {
    if (!p.close) continue;
    const o = p.open.hour * 60 + (p.open.minute ?? 0);
    let c = p.close.hour * 60 + (p.close.minute ?? 0);
    if (p.close.day !== p.open.day || c <= o) c += 1440;
    const prev = week[p.open.day];
    week[p.open.day] = prev ? [Math.min(prev[0], o), Math.max(prev[1], c)] : [o, c];
  }
  return week;
}
