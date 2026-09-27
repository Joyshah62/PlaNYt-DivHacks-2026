/** 615 -> "10:15am"; 1440+ wraps past midnight. */
export function clock(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const mm = m % 60;
  const suffix = h24 < 12 ? "am" : "pm";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return mm === 0 ? `${h12}${suffix}` : `${h12}:${String(mm).padStart(2, "0")}${suffix}`;
}

/** 95 -> "1h 35m"; 40 -> "40 min". */
export function duration(min: number): string {
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

/** "HH:MM" <-> minutes after midnight, for <input type="time">. */
export function toMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const min = Number(match[1]) * 60 + Number(match[2]);
  return min >= 0 && min < 1440 ? min : null;
}

export function toHHMM(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Today's date in New York, YYYY-MM-DD, whatever the server's zone. */
export function nycToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(now);
}

/** Weekday (0 = Sunday) of a YYYY-MM-DD date, independent of time zone. */
export function weekdayOf(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

/** A YYYY-MM-DD date n days later (or earlier). */
export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Minutes after midnight right now in New York, whatever the device's zone. */
export function nycNowMin(now = new Date()): number {
  const [h, m] = new Intl.DateTimeFormat("en-GB", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .format(now)
    .split(":")
    .map(Number);
  return h * 60 + m;
}
