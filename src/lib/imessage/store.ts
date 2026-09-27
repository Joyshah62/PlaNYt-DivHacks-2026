import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { ChatReply } from "@/lib/discover/chat";
import type { DiscoverResponse } from "@/lib/discover/types";
import { getDb, hasMongo } from "@/lib/mongo";
import type { DayPlan, Profile, StopInput } from "@/lib/plan/types";

/** One conversation: a person (or a group chat) and the day they're planning. */
export interface Thread {
  /** The Spectrum space id, e.g. "any;-;+15551234567". */
  id: string;
  plan: DayPlan | null;
  profile: Profile | null;
  /** A change waiting for YES or NO. */
  proposal: DayPlan | null;
  /** The last numbered places, valid only for the trips they were worked out on. */
  offers: {
    results: { name: string; nextStops: StopInput[] }[];
    area: DiscoverResponse["area"];
    intent: DiscoverResponse["intent"];
    tripKeys: string[];
  } | null;
  /** The last lettered answers the assistant offered. */
  choices: ChatReply["choices"];
  history: { role: "user" | "assistant"; text: string }[];
  /** STOP: no messages the person didn't ask for. */
  muted: boolean;
  /** Nudges already sent, by key. */
  sent: string[];
  /** What PlaNYt remembers about them across trips (see lib/memory); kept through a fresh start. */
  memoryId?: string | null;
  /** Their first request, waiting on answers to "when?" and "who?" before it's planned. */
  draft?: string | null;
}

export const newThread = (id: string): Thread => ({ id, plan: null, profile: null, proposal: null, offers: null, choices: [], history: [], muted: false, sent: [] });

export type Store = {
  get: (id: string) => Thread;
  all: () => Thread[];
  save: () => Promise<void>;
};

const COLLECTION = "imessage_threads";

type ThreadDoc = Thread & { _id: string };

function memoryStore(initial: Record<string, Thread>, persist: (threads: Record<string, Thread>) => Promise<void>): Store {
  const threads = initial;
  let writing = Promise.resolve();
  return {
    get: (id: string): Thread => (threads[id] ??= newThread(id)),
    all: (): Thread[] => Object.values(threads),
    save(): Promise<void> {
      const snapshot = { ...threads };
      writing = writing.then(() => persist(snapshot));
      return writing;
    },
  };
}

/** Threads in a JSON file, written whole after each change. Plenty for a handful of people. */
async function openFileStore(path: string): Promise<Store> {
  let threads: Record<string, Thread> = {};
  try {
    threads = JSON.parse(await readFile(path, "utf8"));
  } catch {
    // First run, or an unreadable file: start empty rather than refuse to start.
  }
  return memoryStore(threads, async (snapshot) => {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(`${path}.tmp`, JSON.stringify(snapshot));
    await rename(`${path}.tmp`, path);
  });
}

/**
 * Threads in MongoDB (same cluster as accounts). Used on Render so the web
 * service and iMessage worker share state across restarts with no local disk.
 */
async function openMongoStore(): Promise<Store> {
  const db = await getDb();
  const col = db.collection<ThreadDoc>(COLLECTION);
  const threads: Record<string, Thread> = {};
  for (const doc of await col.find().toArray()) {
    const { _id, ...rest } = doc;
    threads[_id] = { ...newThread(_id), ...rest, id: _id };
  }
  return memoryStore(threads, async (snapshot) => {
    const values = Object.values(snapshot);
    if (!values.length) return;
    await col.bulkWrite(
      values.map((t) => ({
        replaceOne: {
          filter: { _id: t.id },
          replacement: { ...t, _id: t.id },
          upsert: true,
        },
      })),
      { ordered: false },
    );
  });
}

/**
 * Opens the thread store. With `MONGODB_URI`, uses Mongo (required on Render).
 * Otherwise uses the JSON file at `filePath` (local laptop).
 */
export async function openStore(filePath: string): Promise<Store> {
  if (hasMongo()) {
    console.log("[store] imessage threads → MongoDB");
    return openMongoStore();
  }
  console.log(`[store] imessage threads → ${filePath}`);
  return openFileStore(filePath);
}
