/** Crowd levels to words, with no data attached: safe to import in the browser. */

/** Mean level across a visit, weighting each hour by how much of it the visit covers. */
export function levelDuring(levels: number[], startMin: number, endMin: number): number {
  if (endMin <= startMin) return levels[Math.floor(startMin / 60) % 24] ?? 0;
  let sum = 0;
  for (let t = startMin; t < endMin; ) {
    const next = Math.min(endMin, (Math.floor(t / 60) + 1) * 60);
    sum += (levels[Math.floor(t / 60) % 24] ?? 0) * (next - t);
    t = next;
  }
  return sum / (endMin - startMin);
}

export type CrowdBand = "quiet" | "moderate" | "busy" | "peak";

export function crowdBand(level: number): CrowdBand {
  if (level < 0.35) return "quiet";
  if (level < 0.6) return "moderate";
  if (level < 0.82) return "busy";
  return "peak";
}
