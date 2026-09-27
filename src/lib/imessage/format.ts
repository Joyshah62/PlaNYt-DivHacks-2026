import { LEG_VERB } from "@/lib/plan/display";
import { isMealBreak } from "@/lib/plan/profile";
import { clock, duration } from "@/lib/plan/time";
import type { DayPlan, Leg } from "@/lib/plan/types";
import { WEATHER_LABEL, weatherKind, type DayWeather } from "@/lib/plan/weatherCodes";
import type { ChatReply } from "@/lib/discover/chat";
import { partyTotal, type DayBudget } from "@/lib/plan/budget";

/** iMessage has no markdown, so everything here is plain lines and a few emoji. */

export const LETTERS = ["A", "B", "C", "D", "E"];

export const HELP = [
  "I'm Roam, your NYC day planner. Text me what you'd like to do, like:",
  "• \"Saturday with my parents: the Met, a skyline view and pizza\"",
  "",
  "Once you have a day, just say what to change:",
  "• \"add Times Square and a café there\"",
  "• \"drop MoMA\" · \"make it more relaxed\"",
  "",
  "PLAN shows your day · NEW TRIP starts over · STOP pauses my updates",
].join("\n");

const dayLabel = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

export function weatherLine(w: DayWeather): string {
  return `${WEATHER_LABEL[weatherKind(w.code)]} ${w.hi}°/${w.lo}°${w.rain >= 20 ? `, ${w.rain}% rain` : ""}`;
}

/** "12 min by subway: the 4/5 downtown from 86 St" */
export function legLine(leg: Leg): string {
  const ride = leg.mode === "subway" ? leg.rides?.[0] : undefined;
  const how = ride?.lines.length ? `: the ${ride.lines.join("/")} ${ride.direction} from ${ride.from.label}` : "";
  return `${leg.estimated ? "~" : ""}${duration(leg.minutes)} ${LEG_VERB[leg.mode]}${how}`;
}

/** The whole day, one line per stop. */
export function itinerary(plan: DayPlan, opts: { weather?: DayWeather | null; link?: string; budget?: DayBudget | null; people?: number | null } = {}): string {
  const { summary, request } = plan;
  const places = plan.stops.filter((s) => !isMealBreak(s)).length;
  const lines = [
    `📍 ${dayLabel(request.date)} · ${clock(plan.stops[0]?.startMin ?? request.startMin)}–${clock(summary.finishMin)}`,
    `${places} ${places === 1 ? "stop" : "stops"} · ${duration(summary.travelMin)} getting around${opts.weather ? ` · ${weatherLine(opts.weather)}` : ""}`,
    "",
  ];
  let n = 0;
  for (const s of plan.stops) {
    if (s.leg) lines.push(`   ↓ ${legLine(s.leg)}`);
    if (isMealBreak(s)) {
      lines.push(`🍴 ${clock(s.startMin)}  ${s.name}${s.nearbyFood ? ` (try ${s.nearbyFood.name})` : ""}`);
      continue;
    }
    n++;
    const flag = s.issue === "closed" ? " ⚠️ usually closed" : s.issue ? " ⚠️ timing is tight" : "";
    lines.push(`${n}. ${clock(s.startMin)}  ${s.name} · ${duration(s.visitMin)}${flag}`);
  }
  if (plan.returnLeg && request.origin) lines.push(`   ↓ ${legLine(plan.returnLeg)}`, `🏠 ${clock(summary.finishMin)}  back at ${request.origin.label}`);
  if (plan.skipped.length) lines.push("", `Left out: ${plan.skipped.map((s) => `${s.name} (${s.reason.toLowerCase()})`).join(", ")}`);
  if (opts.budget) {
    const book = opts.budget.lines.filter((l) => l.bookAhead).map((l) => l.name);
    const people = opts.people ?? null;
    const cost = people && people > 1 ? `About $${partyTotal(opts.budget, people)} for ${people} people ($${opts.budget.perPerson} each)` : `About $${opts.budget.perPerson} ${people === 1 ? "for you" : "per person"}`;
    lines.push("", `💵 ${cost}: tickets, food and subway.${book.length ? ` Book ahead: ${book.join(", ")}.` : ""}`);
  }
  if (opts.link) lines.push("", `Map: ${opts.link}`);
  return lines.join("\n");
}

/** The model sometimes answers in markdown, which iMessage shows as literal asterisks. */
export function plain(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*|__(.+?)__/g, "$1$2")
    .replace(/^\s*[*-]\s+/gm, "• ")
    .replace(/^#{1,6}\s+/gm, "");
}

/** A trip-chat answer as texts: the words, then numbered places or the change to approve. */
export function chatReply(reply: ChatReply): string[] {
  // Links to what a web answer drew on, so it can be checked.
  const cited = reply.sources?.length ? `\n\nFrom the web: ${reply.sources.slice(0, 2).map((s) => s.url).join(" ")}` : "";
  const out = [plain(reply.message) + cited];
  const results = reply.discovery?.results ?? [];
  if (results.length) {
    out.push(
      results
        .map((r, i) => {
          const when = r.startMin !== null ? ` ${clock(r.startMin)}` : "";
          const where = r.after ? ` after ${r.after}` : "";
          const cost = r.travelDelta > 0 ? `, +${duration(r.travelDelta)} travel` : "";
          const why = r.reasons.slice(0, 2).join(", ");
          const warn = r.closed ? " ⚠️ closed then" : r.conflicts.length ? ` ⚠️ ${r.conflicts[0]}` : "";
          return `${i + 1}. ${r.name} —${when}${where}${cost}${why ? ` · ${why}` : ""}${warn}`;
        })
        .join("\n") + `\n\nReply with a number to add one.`,
    );
  }
  if (reply.proposal) {
    const p = reply.proposal.plan;
    const day = p.stops.filter((s) => !isMealBreak(s)).map((s) => `${clock(s.startMin)} ${s.name}`).join(" → ");
    out.push(
      [
        `✏️ ${reply.proposal.title}`,
        day,
        `Finishes ${clock(p.summary.finishMin)} · ${duration(p.summary.travelMin)} getting around`,
        ...reply.proposal.warnings.map((w) => `⚠️ ${w}`),
        "",
        "Reply YES to apply it or NO to keep your day.",
      ].join("\n"),
    );
  }
  if (reply.choices.length) out.push(`Reply with a letter: ${reply.choices.map((c, i) => `${LETTERS[i]}) ${c.label}`).join("  ")}`);
  return out;
}

export type Command =
  | { kind: "help" | "stop" | "start" | "show" | "yes" | "no" }
  | { kind: "reset"; rest: string }
  | { kind: "pick"; index: number }
  | { kind: "choice"; index: number }
  | { kind: "text"; text: string };

/** Short replies that mean something in context; everything else is a request for the assistant. */
export function parseCommand(raw: string, ctx: { proposal: boolean; offers: number; choices: number }): Command {
  const text = raw.trim();
  const t = text.toLowerCase().replace(/[.!]+$/, "");
  if (/^(help|\?|commands)$/.test(t)) return { kind: "help" };
  if (/^(stop|unsubscribe|mute|pause)$/.test(t)) return { kind: "stop" };
  if (/^(start|unmute|resume)$/.test(t)) return { kind: "start" };
  if (/^(plan|itinerary|my (day|plan|trip)|show( me)?( my)?( (day|plan|trip|itinerary))?)$/.test(t)) return { kind: "show" };
  const reset = /^(new trip|new day|start over|reset)\b[\s:,-]*([\s\S]*)$/i.exec(text);
  if (reset) return { kind: "reset", rest: reset[2].trim() };
  if (ctx.proposal && /^(y|yes|yep|yeah|yup|apply( it)?|ok|okay|do it|sure|sounds good|👍)$/.test(t)) return { kind: "yes" };
  if (ctx.proposal && /^(n|no|nope|nah|keep( it)?|cancel|never ?mind)$/.test(t)) return { kind: "no" };
  const pick = /^(?:add\s+)?(?:option\s+|number\s+|#)?([1-9])$/.exec(t);
  if (pick && Number(pick[1]) <= ctx.offers) return { kind: "pick", index: Number(pick[1]) };
  const choice = /^\(?([a-e])\)?$/.exec(t);
  if (choice && LETTERS.indexOf(choice[1].toUpperCase()) < ctx.choices) return { kind: "choice", index: LETTERS.indexOf(choice[1].toUpperCase()) };
  return { kind: "text", text };
}

/** An iMessage handle: a phone number in E.164 (US numbers may skip the +1), or an Apple ID email. */
export function normalizeHandle(input: string): string | null {
  const s = input.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return s.toLowerCase();
  const digits = s.replace(/\D/g, "");
  if (s.startsWith("+")) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}
