interface Read {
  attractionId: string | null;
  query: string;
  meal: "lunch" | "dinner" | null;
  fixedTime: string | null;
  wish: string | null;
  why: string | null;
  alternatives: { attractionId: string | null; query: string; why: string }[];
}

/**
 * One place per meal. A model sometimes lists three dinner spots as three
 * stops; the first stays, and the rest become its alternatives to swap in.
 * A booking (a set time) is always kept as it is.
 */
export function oneMealEach<T extends Read>(stops: T[]): T[] {
  const kept: T[] = [];
  const first = new Map<string, T>();
  for (const s of stops) {
    const taken = s.meal ? first.get(s.meal) : undefined;
    if (!taken || s.fixedTime) {
      if (s.meal && !taken) first.set(s.meal, s);
      kept.push(s);
      continue;
    }
    const meal = s.meal === "dinner" ? "Dinner" : "Lunch";
    const merged = { ...taken, wish: taken.wish ?? meal, alternatives: [...taken.alternatives, { attractionId: s.attractionId, query: s.query, why: s.why ?? `Another ${meal.toLowerCase()} pick` }] };
    kept[kept.indexOf(taken)] = merged;
    first.set(s.meal!, merged);
  }
  return kept;
}
