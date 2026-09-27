import { Spectrum, type Space } from "spectrum-ts";
import { imessage } from "@spectrum-ts/imessage";
import { nycNowMin, nycToday } from "@/lib/plan/time";
import { createBot } from "@/lib/imessage/bot";
import { startBridge } from "@/lib/imessage/bridge";
import { dueNudges } from "@/lib/imessage/nudges";
import { RoamError, roamClient } from "@/lib/imessage/roam";
import { openStore, type Thread } from "@/lib/imessage/store";

// Roam over iMessage: plan a NYC day by text, change it by text, and get told
// when to leave for each stop. Run it next to the web app with `npm run imessage`;
// the planning happens in the web app (ROAM_URL), this process is the phone side.
// Docs: https://photon.codes/docs/spectrum-ts

const ROAM_URL = process.env.ROAM_URL ?? "http://localhost:3000";
const PUBLIC_URL = (process.env.PUBLIC_APP_URL ?? ROAM_URL).replace(/\/$/, "");
const BRIDGE_PORT = Number(process.env.PHONE_BRIDGE_PORT ?? 4100);
const BRIDGE_TOKEN = process.env.PHONE_BRIDGE_TOKEN ?? "";
const NUDGE_EVERY_MS = 30_000;

const app = await Spectrum({
  projectId: process.env.SPECTRUM_PROJECT_ID!,
  projectSecret: process.env.SPECTRUM_PROJECT_SECRET!,
  providers: [imessage.config()],
});
const im = imessage(app);
const store = await openStore(new URL("../.data/imessage-threads.json", import.meta.url).pathname);
const roam = roamClient(ROAM_URL);
const bot = createBot(roam, PUBLIC_URL);

async function sendAll(space: Space, texts: string[]) {
  for (const text of texts) if (text.trim()) await space.send(text);
}

/**
 * Free and Pro projects send from shared lines, which only message numbers
 * added as users of the project (Photon dashboard > Users). Say so, once per
 * number, instead of a stack trace per text.
 */
const blocked = new Set<string>();
function explainSendError(id: string, error: unknown): boolean {
  if (!(error instanceof Error) || !/Target not allowed/i.test(error.message)) return false;
  if (!blocked.has(id)) {
    blocked.add(id);
    console.warn(`[${id}] Photon won't message this number: add ${id.split(";").pop()} as a user of the project (dashboard > Users, or \`npx @photon-ai/cli spectrum users add\`), then text again.`);
  }
  return true;
}

/** One message at a time per conversation, so quick double-texts don't race each other. */
const queues = new Map<string, Promise<void>>();
function serially(id: string, job: () => Promise<void>) {
  const next = (queues.get(id) ?? Promise.resolve()).then(job).catch((error) => {
    if (!explainSendError(id, error)) console.error(`[${id}]`, error);
  });
  queues.set(id, next);
  return next;
}

async function reply(space: Space, thread: Thread, text: string) {
  try {
    const texts = await space.responding(() => bot.handle(thread, text));
    await store.save();
    await sendAll(space, texts);
  } catch (error) {
    // A number Photon won't message can't be told about it either.
    if (explainSendError(thread.id, error)) return;
    console.error(`[${thread.id}] handling "${text}":`, error);
    await space.send(error instanceof RoamError ? error.message : "Sorry, something went wrong on my end. Try that again in a minute.");
  }
}

// The website's "Text it to me": start (or take over) the conversation with this plan.
if (BRIDGE_TOKEN) {
  startBridge({
    port: BRIDGE_PORT,
    token: BRIDGE_TOKEN,
    async send(handle, request) {
      const space = await im.space.create(await im.user(handle));
      const thread = store.get(space.id);
      const plan = await roam.plan(request);
      await serially(space.id, async () => {
        bot.setPlan(thread, plan);
        thread.history = [];
        thread.muted = false;
        await store.save();
        await sendAll(space, [
          "👋 Hi from Roam! Here's your NYC day.",
          await bot.show(plan, thread.profile),
          "Text me to change anything (\"add a café after the Met\"). On the day, I'll text you when it's time to head to each stop. Reply STOP to pause updates.",
        ]);
      });
    },
  });
} else {
  console.warn("[bridge] PHONE_BRIDGE_TOKEN is not set, so the website can't send plans to phones.");
}

// Day-of nudges: the morning rundown, "leave now" before each leg, meal time.
setInterval(() => {
  const today = nycToday();
  const now = nycNowMin();
  for (const thread of store.all()) {
    if (thread.muted || thread.plan?.request.date !== today) continue;
    void serially(thread.id, async () => {
      const plan = thread.plan!;
      const due = dueNudges(plan, today, now, new Set(thread.sent), await roam.weather(today));
      if (!due.length) return;
      const space = await im.space.get(thread.id);
      for (const n of due) {
        // Marked before sending: a failed send is skipped rather than repeated every tick.
        thread.sent = [...thread.sent.filter((k) => k.startsWith(today)), n.key];
        await store.save();
        await space.send(n.text);
      }
    });
  }
}, NUDGE_EVERY_MS);

console.log(`Roam iMessage bot is running. Planner: ${ROAM_URL}`);

for await (const [space, message] of app.messages) {
  if (message.direction === "outbound" || message.content.type !== "text") continue;
  const text = message.content.text;
  void serially(space.id, () => reply(space, store.get(space.id), text));
}
