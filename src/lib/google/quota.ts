import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * A hard cap on Google Places calls, per billed SKU, so the project stays inside
 * Google's free monthly usage and is never charged:
 *
 *   search - discovery's Text Search with ratings, prices and hours:
 *            "Text Search Enterprise", 1,000 free a month, then $35 per 1,000.
 *   photos - one photo = a Text Search asking only for photos ("Text Search Pro",
 *            5,000 free) plus the image itself ("Place Details Photos", 1,000
 *            free, then $7 per 1,000). The smaller free tier sets the cap.
 *
 * Defaults sit at 950 a month, under the 1,000 free, counted by Google's billing
 * month (Pacific time). A call is counted before it's made, so slow or failed
 * calls still count; only outright refusals (403: not billed) are given back.
 * The counts live in .data/google-usage.json: deleting that file resets them,
 * and each server keeps its own. Set a quota in Google Cloud as the backstop.
 */

export type Sku = "search" | "photos";

const env = (name: string, fallback: number) => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n >= 0 && process.env[name] !== "" && process.env[name] !== undefined ? n : fallback;
};

export const CAPS: Record<Sku, { month: number; day: number }> = {
  search: { month: env("GOOGLE_SEARCH_MONTHLY_CAP", 950), day: env("GOOGLE_SEARCH_DAILY_CAP", 100) },
  photos: { month: env("GOOGLE_PHOTOS_MONTHLY_CAP", 950), day: env("GOOGLE_PHOTOS_DAILY_CAP", 100) },
};

const FILE = path.join(process.cwd(), ".data", "google-usage.json");
const LEGACY_FILE = path.join(process.cwd(), ".data", "google-photo-usage.json");

interface Counts {
  month: number;
  day: number;
}
interface Usage {
  /** Billing month and day, Pacific time: YYYY-MM, YYYY-MM-DD. */
  month: string;
  day: string;
  counts: Record<Sku, Counts>;
}

/** Google's free usage resets with its billing month, which runs on Pacific time. */
const billingDay = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date());

let usage: Usage | null = null;
let writing = Promise.resolve();

async function load(): Promise<Usage> {
  if (usage) return usage;
  const d = billingDay();
  try {
    usage = JSON.parse(await readFile(FILE, "utf8")) as Usage;
  } catch {
    // Carry over the old shared counter (it counted both kinds) so nothing starts from zero.
    let carried = { month: 0, day: 0 };
    try {
      const old = JSON.parse(await readFile(LEGACY_FILE, "utf8")) as { month: string; monthCount: number; day: string; dayCount: number };
      carried = { month: old.month === d.slice(0, 7) ? old.monthCount : 0, day: old.day === d ? old.dayCount : 0 };
    } catch {
      /* no earlier usage */
    }
    usage = { month: d.slice(0, 7), day: d, counts: { search: { ...carried }, photos: { ...carried } } };
  }
  return usage;
}

function persist(u: Usage) {
  const snapshot = JSON.stringify(u);
  writing = writing.then(async () => {
    try {
      await mkdir(path.dirname(FILE), { recursive: true });
      await writeFile(FILE, snapshot);
    } catch (error) {
      console.error("[google quota] couldn't save usage", error);
    }
  });
}

/** Take one call from the SKU's allowance, or refuse. */
export async function reserve(sku: Sku): Promise<boolean> {
  const u = await load();
  const d = billingDay();
  if (u.month !== d.slice(0, 7)) {
    u.month = d.slice(0, 7);
    for (const c of Object.values(u.counts)) c.month = 0;
  }
  if (u.day !== d) {
    u.day = d;
    for (const c of Object.values(u.counts)) c.day = 0;
  }
  const c = u.counts[sku];
  if (c.month >= CAPS[sku].month || c.day >= CAPS[sku].day) return false;
  c.month++;
  c.day++;
  persist(u);
  return true;
}

/** Give a call back when Google refused it outright: refused calls aren't billed. */
export function release(sku: Sku) {
  if (!usage) return;
  const c = usage.counts[sku];
  c.month = Math.max(0, c.month - 1);
  c.day = Math.max(0, c.day - 1);
  persist(usage);
}

export async function usageReport() {
  const u = await load();
  return (Object.keys(CAPS) as Sku[]).map((sku) => ({ sku, used: u.counts[sku], cap: CAPS[sku], billingMonth: u.month }));
}
