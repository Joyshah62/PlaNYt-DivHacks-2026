export interface FreeWindow {
  /** Minutes after midnight of the trip day; past 1440 means after midnight. */
  from: number;
  to: number;
}

export interface GroupWindow extends FreeWindow {
  everyone: boolean;
  /** People who aren't free for the whole window. */
  missing: string[];
}

const MIN_WINDOW = 60;

/** The time everyone is free, or failing that, the window (≥ 1 hour) that the most people can make. */
export function sharedWindow(free: Record<string, FreeWindow>): GroupWindow | null {
  const people = Object.entries(free);
  if (!people.length) return null;
  const from = Math.max(...people.map(([, w]) => w.from));
  const to = Math.min(...people.map(([, w]) => w.to));
  if (to - from >= MIN_WINDOW) return { from, to, everyone: true, missing: [] };

  let best: GroupWindow | null = null;
  for (const [, a] of people) {
    for (const [, b] of people) {
      const start = a.from;
      const end = b.to;
      if (end - start < MIN_WINDOW) continue;
      const inside = people.filter(([, w]) => w.from <= start && w.to >= end).map(([id]) => id);
      if (!inside.length) continue;
      const better = !best || inside.length > people.length - best.missing.length || (inside.length === people.length - best.missing.length && end - start > best.to - best.from);
      if (better) best = { from: start, to: end, everyone: false, missing: people.map(([id]) => id).filter((id) => !inside.includes(id)) };
    }
  }
  return best;
}

export function applyWindow<T extends { startMin: number; endMin: number }>(settings: T, window: GroupWindow | null): T {
  return window ? { ...settings, startMin: window.from, endMin: window.to } : settings;
}

export function missingFor(free: Record<string, FreeWindow>, start: number, end: number): string[] {
  return Object.entries(free)
    .filter(([, w]) => w.from > start || w.to < end)
    .map(([id]) => id);
}
