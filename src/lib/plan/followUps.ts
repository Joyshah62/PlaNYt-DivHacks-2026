import { addDays, WEEKDAYS, weekdayOf } from "./time";
import type { Group } from "./types";

/** A question worth asking before planning, with answers that read as the traveler's own words. */
export interface FollowUp {
  id: "when" | "who";
  question: string;
  choices: { label: string; answer: string }[];
}

const dayLabel = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" });

/** The next Saturday and Sunday after today (this weekend, or next if it's already the weekend). */
function weekend(today: string): string[] {
  const sat = addDays(today, (6 - weekdayOf(today) + 7) % 7 || 7);
  return [sat, addDays(sat, 1)];
}

/**
 * What the request left out that changes the day: when (hours, closures,
 * crowds) and who's coming (pace, walking, what suits them). Asked once,
 * before planning; anything they already said, or PlaNYt already knows, isn't.
 */
export function followUps(
  understood: { date: string | null; group: Group | null; nearMe: boolean },
  ctx: { today: string; knowsGroup: boolean },
): FollowUp[] {
  const out: FollowUp[] = [];
  // "Near me" means now.
  if (!understood.date && !understood.nearMe) {
    const tomorrow = addDays(ctx.today, 1);
    const days = [...new Set([tomorrow, ...weekend(ctx.today)])].filter((d) => d > tomorrow);
    out.push({
      id: "when",
      question: "When are you going?",
      choices: [
        { label: "Today", answer: `going today (${dayLabel(ctx.today)})` },
        { label: "Tomorrow", answer: `going tomorrow (${dayLabel(tomorrow)})` },
        ...days.map((d) => ({ label: WEEKDAYS[weekdayOf(d)].slice(0, 3) + " " + Number(d.slice(8)), answer: `going on ${dayLabel(d)} (${d})` })),
      ],
    });
  }
  if (!understood.group && !ctx.knowsGroup) {
    out.push({
      id: "who",
      question: "Who's coming?",
      choices: [
        { label: "Just me", answer: "just me" },
        { label: "Two of us", answer: "the two of us" },
        { label: "Family with kids", answer: "a family with kids" },
        { label: "With older parents", answer: "with my older parents" },
      ],
    });
  }
  return out;
}

/** The request with their answers added, ready to plan. */
export function withAnswers(text: string, answers: string[]): string {
  return answers.length ? `${text.trim().replace(/[.\s]+$/, "")}. ${answers.join(", ")}.` : text;
}
