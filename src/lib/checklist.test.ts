import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CHECKLIST_SCHEMA_VERSION,
  mergeSuggestions,
  readStoredChecklist,
  storageKey,
  type StoredChecklist,
} from "./checklist";
import type { ChecklistItem } from "./nyc/types";

/** A minimal localStorage that individual tests can make fail on demand. */
function fakeStorage() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  };
}

const BIN_A = "3343260";
const BIN_B = "3061615";

const SUGGESTIONS: ChecklistItem[] = [
  { id: "open-class-c-q0", text: "Ask about the Class C violations.", kind: "question", insightId: "open-class-c" },
  { id: "repeated-heating-q0", text: "Ask what heating repairs were made.", kind: "question", insightId: "repeated-heating" },
];

let storage: ReturnType<typeof fakeStorage>;

beforeEach(() => {
  storage = fakeStorage();
  vi.stubGlobal("window", { localStorage: storage });
});

function write(bin: string, state: Partial<StoredChecklist>) {
  const full: StoredChecklist = {
    version: CHECKLIST_SCHEMA_VERSION,
    bin,
    items: [],
    notes: "",
    dismissed: [],
    ...state,
  };
  storage.setItem(storageKey(bin), JSON.stringify(full));
  return full;
}

describe("persistence", () => {
  it("round-trips a stored checklist", () => {
    write(BIN_A, {
      items: [{ id: "a", text: "Ask about heat", kind: "question", checked: true, custom: false }],
      notes: "Super said the boiler is new.",
    });

    const read = readStoredChecklist(BIN_A)!;
    expect(read.items[0].checked).toBe(true);
    expect(read.notes).toBe("Super said the boiler is new.");
  });

  it("ignores a checklist written under an older schema version", () => {
    storage.setItem(
      storageKey(BIN_A),
      JSON.stringify({ version: CHECKLIST_SCHEMA_VERSION - 1, bin: BIN_A, items: [], notes: "old" }),
    );
    expect(readStoredChecklist(BIN_A)).toBeNull();
  });

  it("ignores corrupt stored data instead of throwing", () => {
    storage.setItem(storageKey(BIN_A), "{ not json");
    expect(readStoredChecklist(BIN_A)).toBeNull();
  });
});

describe("isolation between buildings", () => {
  it("uses a distinct key per building", () => {
    expect(storageKey(BIN_A)).not.toBe(storageKey(BIN_B));
  });

  it("does not read one building's checklist for another", () => {
    write(BIN_A, { items: [{ id: "a", text: "A", kind: "question", checked: true, custom: false }] });
    expect(readStoredChecklist(BIN_B)).toBeNull();
  });

  it("rejects a payload whose bin does not match the key it was read from", () => {
    // Defends against a stale or hand-edited blob leaking across buildings.
    storage.setItem(
      storageKey(BIN_B),
      JSON.stringify({ version: CHECKLIST_SCHEMA_VERSION, bin: BIN_A, items: [], notes: "", dismissed: [] }),
    );
    expect(readStoredChecklist(BIN_B)).toBeNull();
  });
});

describe("merging suggestions into an existing checklist", () => {
  it("seeds a fresh checklist from the suggestions", () => {
    const merged = mergeSuggestions(null, SUGGESTIONS, BIN_A);
    expect(merged.items.map((i) => i.id)).toEqual([
      "open-class-c-q0",
      "repeated-heating-q0",
    ]);
    expect(merged.items.every((i) => !i.checked)).toBe(true);
  });

  it("preserves checked state and notes when the report reloads", () => {
    const stored = write(BIN_A, {
      items: [
        { id: "open-class-c-q0", text: "Ask about the Class C violations.", kind: "question", checked: true, custom: false },
      ],
      notes: "Asked. Waiting on an answer.",
    });

    const merged = mergeSuggestions(stored, SUGGESTIONS, BIN_A);
    expect(merged.items.find((i) => i.id === "open-class-c-q0")!.checked).toBe(true);
    expect(merged.notes).toBe("Asked. Waiting on an answer.");
  });

  it("keeps items the reader wrote themselves", () => {
    const stored = write(BIN_A, {
      items: [{ id: "custom-1", text: "Check the mailboxes", kind: "question", checked: false, custom: true }],
    });
    const merged = mergeSuggestions(stored, SUGGESTIONS, BIN_A);
    expect(merged.items.find((i) => i.id === "custom-1")).toBeDefined();
    expect(merged.items).toHaveLength(3);
  });

  it("does not resurrect a suggestion the reader removed", () => {
    const stored = write(BIN_A, { items: [], dismissed: ["open-class-c-q0"] });
    const merged = mergeSuggestions(stored, SUGGESTIONS, BIN_A);
    expect(merged.items.map((i) => i.id)).toEqual(["repeated-heating-q0"]);
  });

  it("adds newly suggested items without duplicating existing ones", () => {
    const stored = write(BIN_A, {
      items: [
        { id: "open-class-c-q0", text: "Ask about the Class C violations.", kind: "question", checked: false, custom: false },
      ],
    });
    const merged = mergeSuggestions(stored, SUGGESTIONS, BIN_A);
    expect(merged.items).toHaveLength(2);
    expect(merged.items.filter((i) => i.id === "open-class-c-q0")).toHaveLength(1);
  });
});

describe("unavailable local storage", () => {
  it("returns null rather than throwing when reads are blocked", () => {
    vi.stubGlobal("window", {
      get localStorage(): Storage {
        throw new Error("SecurityError: storage is disabled");
      },
    });
    expect(() => readStoredChecklist(BIN_A)).not.toThrow();
    expect(readStoredChecklist(BIN_A)).toBeNull();
  });

  it("still produces a usable in-memory checklist with no storage", () => {
    const merged = mergeSuggestions(null, SUGGESTIONS, BIN_A);
    expect(merged.items).toHaveLength(2);
  });
});
