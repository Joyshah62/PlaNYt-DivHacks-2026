import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { ChatReply } from "@/lib/discover/chat";
import type { DiscoverResponse } from "@/lib/discover/types";
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
  /** What Roam remembers about them across trips (see lib/memory); kept through a fresh start. */
  memoryId?: string | null;
  /** Their first request, waiting on answers to "when?" and "who?" before it's planned. */
  draft?: string | null;
}

export const newThread = (id: string): Thread => ({ id, plan: null, profile: null, proposal: null, offers: null, choices: [], history: [], muted: false, sent: [] });

/** Threads in a JSON file, written whole after each change. Plenty for a handful of people. */
export async function openStore(path: string) {
  let threads: Record<string, Thread> = {};
  try {
    threads = JSON.parse(await readFile(path, "utf8"));
  } catch {
    // First run, or an unreadable file: start empty rather than refuse to start.
  }
  let writing = Promise.resolve();
  return {
    get: (id: string): Thread => (threads[id] ??= newThread(id)),
    all: (): Thread[] => Object.values(threads),
    /** Saves in order; a crash mid-write leaves the previous file, not half of one. */
    save(): Promise<void> {
      const snapshot = JSON.stringify(threads);
      writing = writing.then(async () => {
        await mkdir(dirname(path), { recursive: true });
        await writeFile(`${path}.tmp`, snapshot);
        await rename(`${path}.tmp`, path);
      });
      return writing;
    },
  };
}
export type Store = Awaited<ReturnType<typeof openStore>>;
