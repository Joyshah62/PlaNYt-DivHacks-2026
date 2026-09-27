import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { grokJson, grokKey } from "@/lib/llm/grok";
import { assembleBudget, priceKindOf, type DayBudget } from "@/lib/plan/budget";
import { isMealBreak } from "@/lib/plan/profile";
import type { DayPlan } from "@/lib/plan/types";
import { webSearch, webSearchEnabled } from "./tavily";

/**
 * What a place costs one adult, read from the web: a ticket for a museum or a
 * deck, a typical spend for a restaurant. Grok only reads the search results
 * into numbers; nothing is priced from memory. Cached for two weeks, so each
 * place costs one search and one read.
 */

export interface PriceInfo {
  /** Adult ticket, or the middle of a restaurant's usual per-person range. Null when the web didn't say. */
  perPerson: number | null;
  free: boolean;
  /** Timed tickets that sell out, or a reservation that's hard to get. */
  bookAhead: boolean;
  /** A short caveat worth showing: "Pay what you wish for NY residents", "$25–35 per person". */
  note: string | null;
  url: string | null;
}

const TTL_MS = 14 * 24 * 60 * 60_000;
const CACHE_FILE = `${process.cwd()}/.data/prices.json`;

let cache: Record<string, { at: number; info: PriceInfo | null }> | null = null;
const inFlight = new Map<string, Promise<PriceInfo | null>>();

async function load() {
  if (cache) return cache;
  try {
    cache = JSON.parse(await readFile(CACHE_FILE, "utf8"));
  } catch {
    cache = {};
  }
  return cache!;
}

async function save() {
  try {
    await mkdir(dirname(CACHE_FILE), { recursive: true });
    await writeFile(CACHE_FILE, JSON.stringify(cache));
  } catch {
    // A read-only disk (serverless) just means lookups aren't kept between restarts.
  }
}

const id = (name: string) => name.trim().toLowerCase();

/** A price already looked up, without searching: for answers that mustn't wait. */
export function cachedPrice(name: string): PriceInfo | null | undefined {
  const hit = cache?.[id(name)];
  return hit && Date.now() - hit.at < TTL_MS ? hit.info : undefined;
}

const SCHEMA = {
  name: "price",
  schema: {
    type: "object",
    properties: {
      free: { type: "boolean", description: "true only if the results say general entry is free for everyone." },
      adultPrice: { type: ["number", "null"], description: "Standard adult general admission in US dollars, from the results. null if not stated." },
      perPersonLow: { type: ["number", "null"], description: "For a restaurant, café or bar: the low end of a typical spend per person, from a range the results state, or worked out from menu prices they list (one main, or two slices, plus a drink). null if they give neither." },
      perPersonHigh: { type: ["number", "null"], description: "The high end of that range. null otherwise." },
      bookAhead: { type: "boolean", description: "true if the results say timed tickets or reservations are needed or often sell out." },
      note: { type: ["string", "null"], description: "Under 10 words, a specific caveat worth knowing (\"Pay what you wish for NY residents\", \"Free Fridays 5:30–8:30pm\", \"Cash only\"). null if none; never a generic one like \"prices may vary\", and never a discount or a reseller's offer." },
      source: { type: ["integer", "null"], description: "The number of the result the price came from, preferring the place's own official website when it states the price. null if none." },
    },
    required: ["free", "adultPrice", "perPersonLow", "perPersonHigh", "bookAhead", "note", "source"],
    additionalProperties: false,
  },
};

const SYSTEM = `You read web search results about one New York City place and report what it costs one adult, as JSON. Use only numbers stated in the results; if they don't give a price, use null. Never guess from memory. Prices are in US dollars.`;

async function readPrice(name: string, kind: "ticket" | "food", query: string): Promise<PriceInfo | null> {
  const found = await webSearch(query);
  if (!found?.results.length) return null;
  const answer = (await grokJson(
    SYSTEM,
    `Place: ${name}\n\nSearch summary: ${found.answer ?? "none"}\n\nResults:\n${found.results.map((r, i) => `${i + 1}. ${r.title} (${r.url})\n${r.content}`).join("\n\n")}`,
    SCHEMA,
    { effort: "low", timeoutMs: 20_000 },
  ).catch(() => null)) as { free: boolean; adultPrice: number | null; perPersonLow: number | null; perPersonHigh: number | null; bookAhead: boolean; note: string | null; source: number | null } | null;
  if (!answer) return null;
  const range = answer.perPersonLow !== null && answer.perPersonHigh !== null ? (answer.perPersonLow + answer.perPersonHigh) / 2 : (answer.perPersonLow ?? answer.perPersonHigh);
  const perPerson = answer.free ? 0 : kind === "ticket" ? (answer.adultPrice ?? range) : (range ?? answer.adultPrice);
  const sane = perPerson !== null && perPerson >= 0 && perPerson < 1000 ? Math.round(perPerson) : null;
  const spread = kind === "food" && answer.perPersonLow !== null && answer.perPersonHigh !== null && answer.perPersonHigh > answer.perPersonLow ? `$${answer.perPersonLow}–${answer.perPersonHigh} per person` : null;
  return {
    perPerson: sane,
    free: answer.free,
    bookAhead: answer.bookAhead,
    // Filler caveats say nothing a reader doesn't already assume.
    note: (answer.note && !/(may|subject to) (vary|change)|prices? (vary|change)|check (the )?(website|site)/i.test(answer.note) ? answer.note : null) ?? spread,
    url: answer.source ? (found.results[answer.source - 1]?.url ?? null) : null,
  };
}

/** Official pages first; if they don't state a price, one plainer search. */
async function lookUp(name: string, kind: "ticket" | "food"): Promise<PriceInfo | null> {
  const queries = kind === "ticket"
    ? [`${name} NYC official site general admission adult ticket price`, `${name} New York ticket price adult`]
    : [`${name} NYC menu prices`, `${name} New York how much does it cost per person`];
  let best: PriceInfo | null = null;
  for (const q of queries) {
    const info = await readPrice(name, kind, q);
    if (info && (info.perPerson !== null || info.free)) return info;
    best ??= info;
  }
  return best;
}

/** The price of one place, from the cache or the web; null when it can't be known (no keys, nothing found). */
export async function priceOf(name: string, kind: "ticket" | "food"): Promise<PriceInfo | null> {
  if (!webSearchEnabled() || !grokKey()) return null;
  const key = id(name);
  const store = await load();
  const hit = store[key];
  if (hit && Date.now() - hit.at < TTL_MS) return hit.info;
  const pending = inFlight.get(key);
  if (pending) return pending;
  const job = lookUp(name, kind)
    .catch(() => null)
    .then(async (info) => {
      // A miss is retried after a day rather than kept for two weeks.
      const found = info && (info.perPerson !== null || info.free);
      store[key] = { at: found ? Date.now() : Date.now() - TTL_MS + 24 * 60 * 60_000, info };
      await save();
      return info;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, job);
  return job;
}

/**
 * The day's budget. With `cachedOnly`, places not looked up yet count as
 * unknown instead of waiting on the web: for the chat, which must answer fast.
 */
export async function budgetFor(plan: DayPlan, cachedOnly = false): Promise<DayBudget> {
  await load();
  const priced = plan.stops.filter((s) => !isMealBreak(s)).flatMap((s) => {
    const kind = priceKindOf(s);
    return kind === "free" ? [] : [{ s, kind }];
  });
  const found = await Promise.all(priced.map(async ({ s, kind }) => [s.key, cachedOnly ? (cachedPrice(s.name) ?? null) : await priceOf(s.name, kind)] as const));
  return assembleBudget(plan, new Map(found));
}
