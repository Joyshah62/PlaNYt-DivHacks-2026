"use client";

import { createContext, useContext, useMemo, useRef, useState } from "react";
import type { ChecklistItem } from "./nyc/types";

/** Bump when the stored shape changes; old keys are then simply ignored. */
export const CHECKLIST_SCHEMA_VERSION = 1;

export function storageKey(bin: string): string {
  return `rentcheck:checklist:v${CHECKLIST_SCHEMA_VERSION}:${bin}`;
}

export interface StoredItem {
  id: string;
  text: string;
  kind: ChecklistItem["kind"];
  checked: boolean;
  /** Added by the reader rather than suggested by the report. */
  custom: boolean;
}

export interface StoredChecklist {
  version: number;
  bin: string;
  items: StoredItem[];
  notes: string;
  /** Suggested items the reader removed, so a reload does not resurrect them. */
  dismissed: string[];
}

function emptyState(bin: string): StoredChecklist {
  return { version: CHECKLIST_SCHEMA_VERSION, bin, items: [], notes: "", dismissed: [] };
}

export function readStoredChecklist(bin: string): StoredChecklist | null {
  try {
    const raw = window.localStorage.getItem(storageKey(bin));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredChecklist;
    // A stored blob for another building or an older schema is not ours to use.
    if (parsed.version !== CHECKLIST_SCHEMA_VERSION || parsed.bin !== bin) return null;
    if (!Array.isArray(parsed.items)) return null;
    return {
      ...emptyState(bin),
      ...parsed,
      dismissed: Array.isArray(parsed.dismissed) ? parsed.dismissed : [],
    };
  } catch {
    return null;
  }
}

/**
 * Merges freshly suggested items into what the reader already has. Existing
 * items keep their checked state, notes are never touched, and anything the
 * reader removed stays removed.
 */
export function mergeSuggestions(
  stored: StoredChecklist | null,
  suggestions: ChecklistItem[],
  bin: string,
): StoredChecklist {
  const base = stored ?? emptyState(bin);
  const known = new Set(base.items.map((i) => i.id));
  const dismissed = new Set(base.dismissed);

  const added = suggestions
    .filter((s) => !known.has(s.id) && !dismissed.has(s.id))
    .map<StoredItem>((s) => ({
      id: s.id,
      text: s.text,
      kind: s.kind,
      checked: false,
      custom: false,
    }));

  return { ...base, items: [...base.items, ...added] };
}

/** Whether this browser will actually retain what we write. */
function canPersist(): boolean {
  try {
    const probe = "rentcheck:probe";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

interface ChecklistApi {
  items: StoredItem[];
  notes: string;
  /** False when localStorage is unavailable - the list still works in memory. */
  persisted: boolean;
  has: (id: string) => boolean;
  add: (item: { id: string; text: string; kind: ChecklistItem["kind"] }) => void;
  addCustom: (text: string) => void;
  remove: (id: string) => void;
  toggle: (id: string) => void;
  setNotes: (notes: string) => void;
  clear: () => void;
  asText: (heading: string) => string;
}

const ChecklistContext = createContext<ChecklistApi | null>(null);

export function ChecklistProvider({
  bin,
  suggestions,
  children,
}: {
  bin: string;
  suggestions: ChecklistItem[];
  children: React.ReactNode;
}) {
  // This subtree mounts only after the report has loaded on the client, so
  // reading storage in the initializer cannot cause a hydration mismatch - and
  // it avoids the flash of an empty checklist that an effect would produce.
  const [state, setState] = useState<StoredChecklist>(() =>
    mergeSuggestions(readStoredChecklist(bin), suggestions, bin),
  );
  const [persisted, setPersisted] = useState(() => canPersist());
  const latest = useRef(state);

  const api = useMemo<ChecklistApi>(() => {
    // Every mutation writes through here, so persistence is driven by the
    // reader's actions rather than by an effect watching state.
    const update = (fn: (s: StoredChecklist) => StoredChecklist) => {
      const next = fn(latest.current);
      latest.current = next;
      setState(next);
      try {
        window.localStorage.setItem(storageKey(bin), JSON.stringify(next));
      } catch {
        // Private mode, disabled storage, or a full quota. The list keeps
        // working; we only stop promising it will still be here tomorrow.
        setPersisted(false);
      }
    };

    return {
      items: state.items,
      notes: state.notes,
      persisted,
      has: (id) => state.items.some((i) => i.id === id),
      add: (item) =>
        update((s) =>
          s.items.some((i) => i.id === item.id)
            ? s
            : {
                ...s,
                dismissed: s.dismissed.filter((d) => d !== item.id),
                items: [...s.items, { ...item, checked: false, custom: false }],
              },
        ),
      addCustom: (text) =>
        update((s) => ({
          ...s,
          items: [
            ...s.items,
            {
              id: `custom-${Date.now()}-${s.items.length}`,
              text,
              kind: "question",
              checked: false,
              custom: true,
            },
          ],
        })),
      remove: (id) =>
        update((s) => ({
          ...s,
          items: s.items.filter((i) => i.id !== id),
          dismissed: s.dismissed.includes(id) ? s.dismissed : [...s.dismissed, id],
        })),
      toggle: (id) =>
        update((s) => ({
          ...s,
          items: s.items.map((i) =>
            i.id === id ? { ...i, checked: !i.checked } : i,
          ),
        })),
      setNotes: (notes) => update((s) => ({ ...s, notes })),
      clear: () =>
        update((s) => ({
          ...emptyState(s.bin),
          // Suggestions become dismissed, so a reload starts genuinely empty.
          dismissed: [...new Set([...s.dismissed, ...s.items.map((i) => i.id)])],
        })),
      asText: (heading) =>
        [
          heading,
          "",
          ...state.items.map((i) => `${i.checked ? "[x]" : "[ ]"} ${i.text}`),
          ...(state.notes.trim() ? ["", "Notes:", state.notes.trim()] : []),
        ].join("\n"),
    };
  }, [state, persisted, bin]);

  return (
    <ChecklistContext.Provider value={api}>{children}</ChecklistContext.Provider>
  );
}

export function useChecklist(): ChecklistApi {
  const api = useContext(ChecklistContext);
  if (!api) throw new Error("useChecklist must be used inside ChecklistProvider");
  return api;
}
