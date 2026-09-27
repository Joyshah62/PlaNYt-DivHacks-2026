import type { ChatReply } from "@/lib/discover/chat";
import type { AssistantResult, DayPlan, PlanRequest, Profile, StopInput } from "@/lib/plan/types";
import type { DayWeather, Forecast } from "@/lib/plan/weatherCodes";
import type { DiscoverResponse } from "@/lib/discover/types";
import type { DayBudget } from "@/lib/plan/budget";

/** What the bot needs from the PlaNYt web app. All the planning happens there; this is only a client. */
export interface Roam {
  assistant(text: string, profile: Profile, opts?: AssistantOptions): Promise<AssistantResult>;
  plan(request: PlanRequest): Promise<DayPlan>;
  tripChat(body: TripChatBody): Promise<ChatReply>;
  weather(date: string): Promise<DayWeather | null>;
  /** The day's budget, or null if it isn't ready within a few seconds. */
  budget(request: PlanRequest): Promise<DayBudget | null>;
  /** A short id for a plan code (opened at /p/<id>), or null if the web app can't make one. */
  shortLink(code: string): Promise<string | null>;
}

export interface AssistantOptions {
  memoryId?: string | null;
  /** Who's coming is known already, so don't ask. */
  knowsGroup?: boolean;
  /** They've answered the questions (or skipped them): plan now. */
  skipQuestions?: boolean;
}

export interface TripChatBody {
  request: PlanRequest;
  message: string;
  action?: { name: "preview_place"; index: number };
  history: { role: "user" | "assistant"; text: string }[];
  offers: { name: string; nextStops: StopInput[] }[];
  previousArea?: DiscoverResponse["area"];
  previous: DiscoverResponse["intent"] | null;
  memoryId?: string | null;
}

export class RoamError extends Error {
  /** The web app's HTTP status; null when it couldn't be reached. A 4xx is an answer for the person, not a fault. */
  constructor(message: string, readonly status: number | null = null) {
    super(message);
  }
}

export function roamClient(baseUrl: string, bridgeToken = process.env.PHONE_BRIDGE_TOKEN): Roam {
  async function call<T>(path: string, init?: RequestInit, timeoutMs = 60_000): Promise<T> {
    let res: Response;
    try {
      res = await fetch(new URL(path, baseUrl), { ...init, signal: AbortSignal.timeout(timeoutMs) });
    } catch {
      throw new RoamError("I can't reach the planner right now. Try again in a minute.");
    }
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    // The web app's errors are written for people, so they go straight to the text.
    if (!res.ok) throw new RoamError(body.error ?? "Something went wrong on my end. Try again in a minute.", res.status);
    return body as T;
  }
  const post = <T>(path: string, body: unknown) =>
    call<T>(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

  let forecast: { at: number; data: Forecast | null } | null = null;
  return {
    assistant: (text, profile, opts = {}) => post("/api/assistant", { text, profile, ...opts }),
    plan: (request) => post("/api/plan", request),
    tripChat: (body) => post("/api/trip-chat", body),
    // Prices first seen take a while to look up; the itinerary goes without rather than waiting.
    budget: (request) => call<DayBudget>("/api/budget", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ request }) }, 8_000).catch(() => null),
    shortLink: (code) =>
      call<{ id: string }>("/api/plan/short", { method: "POST", headers: { "content-type": "application/json", ...(bridgeToken && { authorization: `Bearer ${bridgeToken}` }) }, body: JSON.stringify({ code }) }, 5_000).then((b) => b.id, () => null),
    async weather(date) {
      // The forecast changes slowly; one fetch per half hour covers every trip.
      if (!forecast || Date.now() - forecast.at > 30 * 60_000) {
        const data = await call<Forecast>("/api/weather", undefined, 15_000).catch(() => null);
        forecast = { at: Date.now(), data };
      }
      return forecast.data?.days.find((d) => d.date === date) ?? null;
    },
  };
}
