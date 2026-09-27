import { defaultSettings, fromAssistant, toRequest } from "@/lib/plan/fromAssistant";
import { DEFAULT_PROFILE, partySize } from "@/lib/plan/profile";
import { encodePlan } from "@/lib/plan/share";
import { nycToday } from "@/lib/plan/time";
import type { DayPlan, PlanRequest, Profile } from "@/lib/plan/types";
import { withAnswers } from "@/lib/plan/followUps";
import { chatReply, HELP, itinerary, parseCommand } from "./format";
import type { Roam } from "./roam";
import type { Thread } from "./store";

const HISTORY = 20;
const tripKey = (r: PlanRequest) => JSON.stringify(r);

/**
 * The conversation, without the transport: a text comes in, the thread
 * changes, texts go out. The first message plans a day with the same assistant
 * as the website; after that, messages edit it through the trip chat, with
 * numbered places and YES/NO for changes instead of buttons.
 */
export function createBot(roam: Roam, publicUrl: string) {
  /** A short /p/ link when the web app can make one; the full plan link otherwise. */
  const link = async (r: PlanRequest) => {
    const code = encodePlan(r);
    const id = await roam.shortLink(code);
    return id ? `${publicUrl}/p/${id}` : `${publicUrl}/plan?plan=${code}`;
  };
  /** The day as a text; with the traveler's profile, the budget totals for everyone going. */
  const show = async (plan: DayPlan, profile?: Profile | null) => {
    const [weather, budget, url] = await Promise.all([roam.weather(plan.request.date), roam.budget(plan.request), link(plan.request)]);
    return itinerary(plan, { weather, budget, link: url, people: profile ? partySize(profile) : null });
  };

  /** A fresh plan (or none) replaces everything that was about the old one. */
  function setPlan(thread: Thread, plan: DayPlan | null) {
    thread.plan = plan;
    thread.proposal = null;
    thread.offers = null;
    thread.choices = [];
  }

  async function startTrip(thread: Thread, text: string, skipQuestions = false): Promise<string[]> {
    const r = await roam.assistant(text.slice(0, 1500), thread.profile ?? DEFAULT_PROFILE, { memoryId: thread.memoryId ?? null, knowsGroup: !!thread.profile, skipQuestions });
    if (r.memoryId) thread.memoryId = r.memoryId;
    if (r.questions?.length) {
      // Their next text answers these, in their own words.
      thread.draft = text;
      return [r.reply, ...r.questions.map((q) => `${q.question} ${q.choices.map((c) => c.label).join(", ")}?`), "Or text SKIP and I'll just plan it."];
    }
    thread.draft = null;
    const { settings, profile, stops } = fromAssistant(r, defaultSettings(nycToday()), thread.profile ?? DEFAULT_PROFILE);
    thread.profile = profile;
    const missing = r.unresolved.length ? `I couldn't find ${r.unresolved.join(", ")} on the map. Try the full name or an address.` : null;
    if (!stops.length) return [r.reply, missing].filter((x): x is string => !!x);
    const first = !thread.plan;
    setPlan(thread, await roam.plan(toRequest(stops, settings, profile)));
    thread.history = [{ role: "user", text }, { role: "assistant", text: r.reply }];
    return [
      r.reply,
      await show(thread.plan!, thread.profile),
      ...(missing ? [missing] : []),
      ...(first ? ["Text me to change anything (\"add a café after the Met\"). On the day, I'll text you when it's time to head to each stop."] : []),
    ];
  }

  async function chat(thread: Thread, text: string, action?: { name: "preview_place"; index: number }): Promise<string[]> {
    const plan = thread.plan!;
    const offers = thread.offers?.tripKeys.includes(tripKey(plan.request)) ? thread.offers : null;
    const reply = await roam.tripChat({
      request: plan.request,
      // Kept within what the web app accepts: a long voice note or a full itinerary in the history
      // would otherwise be refused outright.
      message: text.slice(0, 600),
      action,
      history: thread.history.slice(-HISTORY).map((h) => ({ ...h, text: h.text.slice(0, 2000) })),
      offers: (offers?.results ?? []).map((o) => ({ ...o, name: o.name.slice(0, 120) })),
      previousArea: offers?.area,
      previous: offers?.intent ?? null,
      memoryId: thread.memoryId ?? null,
    });
    if (reply.memoryId) thread.memoryId = reply.memoryId;
    if (reply.discovery) {
      thread.offers = {
        results: reply.discovery.results.map((r) => ({ name: r.name, nextStops: r.nextStops })),
        area: reply.discovery.area,
        intent: reply.discovery.intent,
        // Searched on top of a proposed change, the places still fit once it's applied.
        tripKeys: [tripKey(plan.request), ...(reply.proposal ? [tripKey(reply.proposal.plan.request)] : [])],
      };
    }
    // A change that worked on the planner is already in; one with problems waits for YES.
    const applied = reply.resolution === "apply" && reply.proposal ? reply.proposal.plan : null;
    if (applied) thread.plan = applied;
    thread.proposal = applied ? null : (reply.proposal?.plan ?? null);
    thread.choices = reply.choices;
    const texts = applied ? [...chatReply({ ...reply, proposal: undefined }), await show(applied, thread.profile)] : chatReply(reply);
    // Over text, saving, sharing and the calendar all come down to the plan's link.
    const actions = reply.actions ?? [];
    if (actions.some((a) => a.action !== "new_plan")) texts.push(`Here's your day to save, share or add to your calendar: ${await link(thread.plan!.request)}`);
    const fresh = actions.find((a) => a.action === "new_plan" && a.text);
    if (fresh) texts.push(...(await startTrip(thread, fresh.text!)));
    thread.history = [...thread.history, { role: "user" as const, text }, { role: "assistant" as const, text: texts.join("\n") }].slice(-HISTORY);
    return texts;
  }

  return {
    link,
    show,
    setPlan,
    async handle(thread: Thread, text: string): Promise<string[]> {
      const hasTrip = !!thread.plan && thread.plan.request.date >= nycToday();
      const offers = hasTrip && thread.offers?.tripKeys.includes(tripKey(thread.plan!.request)) ? thread.offers.results.length : 0;
      const cmd = parseCommand(text, { proposal: !!thread.proposal, offers, choices: thread.choices.length });
      switch (cmd.kind) {
        case "help":
          return [HELP];
        case "stop":
          thread.muted = true;
          return ["Okay, I'll stop sending updates. Text START to turn them back on. You can still text me to plan."];
        case "start":
          thread.muted = false;
          return ["Updates are back on. I'll text you when it's time to head to each stop."];
        case "show":
          return hasTrip ? [await show(thread.plan!, thread.profile)] : ["You don't have a day planned yet. Tell me what you'd like to do!"];
        case "reset":
          setPlan(thread, null);
          thread.history = [];
          thread.draft = null;
          return cmd.rest ? startTrip(thread, cmd.rest) : ["Fresh start. What would you like to do in NYC?"];
        case "yes":
          // Numbered places searched on top of this change still fit, so they stay.
          thread.plan = thread.proposal;
          thread.proposal = null;
          thread.choices = [];
          return ["Done, your day is updated.", await show(thread.plan!, thread.profile)];
        case "no":
          thread.proposal = null;
          return ["Kept your day as it was. What would you like to try instead?"];
        case "pick":
          return chat(thread, `Add option ${cmd.index}`, { name: "preview_place", index: cmd.index });
        case "choice":
          return hasTrip ? chat(thread, thread.choices[cmd.index].message) : startTrip(thread, thread.choices[cmd.index].message);
        case "text":
          if (hasTrip) return chat(thread, cmd.text);
          // An answer to "when?" and "who?" joins the request it was about.
          if (thread.draft) return startTrip(thread, /^(skip|just plan it)[.!]*$/i.test(cmd.text.trim()) ? thread.draft : withAnswers(thread.draft, [cmd.text]), true);
          return startTrip(thread, cmd.text);
      }
    },
  };
}
export type Bot = ReturnType<typeof createBot>;
