/**
 * Web search through Tavily (https://docs.tavily.com), for what the trip data
 * can't know: today's hours, ticket prices, free days, current exhibits,
 * events, closures. Off unless TAVILY_API_KEY is set.
 */

export interface WebResult {
  title: string;
  url: string;
  content: string;
}

export interface WebAnswer {
  /** Tavily's short summary of the results, when it gives one. */
  answer: string | null;
  results: WebResult[];
}

/** Posts and videos make poor sources for hours and prices; official and travel sites answer better. */
const SOCIAL = ["facebook.com", "instagram.com", "tiktok.com", "x.com", "twitter.com", "pinterest.com", "youtube.com", "threads.net"];

/** Basic depth costs 1 credit; the cap bounds a runaway day. */
const DAILY_CAP = Number(process.env.TAVILY_DAILY_CAP ?? 200);
const CACHE_MS = 15 * 60_000;

const cache = new Map<string, { at: number; value: WebAnswer }>();
let spent = { day: "", count: 0 };

export const webSearchEnabled = () => Boolean(process.env.TAVILY_API_KEY);

export async function webSearch(query: string, opts: { recent?: boolean } = {}): Promise<WebAnswer | null> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return null;
  const id = `${opts.recent ? "recent:" : ""}${query.trim().toLowerCase()}`;
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;

  const day = new Date().toISOString().slice(0, 10);
  if (spent.day !== day) spent = { day, count: 0 };
  if (spent.count >= DAILY_CAP) {
    console.warn("[tavily] daily cap reached");
    return null;
  }
  spent.count++;

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        query,
        search_depth: "basic",
        topic: "general",
        max_results: 5,
        include_answer: "basic",
        country: "united states",
        exclude_domains: SOCIAL,
        ...(opts.recent && { time_range: "month" }),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error("[tavily]", res.status, (await res.text()).slice(0, 200));
      return null;
    }
    const body = (await res.json()) as { answer?: string | null; results?: { title?: string; url?: string; content?: string }[] };
    const value: WebAnswer = {
      answer: body.answer?.trim() || null,
      results: (body.results ?? [])
        .filter((r): r is WebResult => Boolean(r.title && r.url && r.content))
        .map((r) => ({ title: r.title, url: r.url, content: r.content.slice(0, 700) })),
    };
    cache.set(id, { at: Date.now(), value });
    return value;
  } catch (error) {
    console.error("[tavily]", error instanceof Error ? error.message : error);
    return null;
  }
}
