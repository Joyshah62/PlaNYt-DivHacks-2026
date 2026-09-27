import type { OpenWindow } from "./attractions";
import { levelDuring } from "./crowdBand";

/**
 * Orders a day's stops. Every order is simulated through the clock - travel,
 * waiting for doors to open, the visit itself - and scored in minutes:
 *
 *   travel + waiting + crowdWeight x (crowd level x visit minutes)
 *   + a heavy penalty for arriving closed, running past closing, or missing a fixed time
 *   + a mild penalty for a meal starting after its window
 *   + double for every minute past the end of the day
 *
 * Meals "float": they happen wherever the day already is, so travel to and from
 * one is zero and the next leg starts from the last real place.
 *
 * All terms are non-negative, so a depth-first search can abandon any partial
 * order that already costs more than the best full one. With the handful of
 * stops a day holds that is exact; a node budget keeps pathological inputs fast.
 */

export interface OptimizeInput {
  visitMin: number[];
  windows: (OpenWindow | "always" | null)[];
  /** 24 hourly crowd levels (0..1) per stop, or null when unknown. */
  levels: (number[] | null)[];
  /** Minutes from stop i to stop j. */
  travel: number[][];
  /** Minutes from the origin to each stop, if the day starts somewhere. */
  fromOrigin: number[] | null;
  /** Minutes from each stop back to the origin, if the day ends there. */
  toOrigin: number[] | null;
  startMin: number;
  endMin: number;
  crowdWeight: number;
  /** Must start at this time (a booking), or null. */
  fixedStart?: (number | null)[];
  /** Preferred start window, e.g. lunch 11:30-14:00: never earlier, mildly penalised later. */
  softWindow?: ([number, number] | null)[];
  /** Stops with no place of their own (meal breaks). */
  floating?: boolean[];
  /** A breather between consecutive places, in minutes. */
  bufferMin?: number;
}

export interface ScheduledVisit {
  index: number;
  arriveMin: number;
  startMin: number;
  endMin: number;
  waitMin: number;
  crowd: number | null;
  issue: "closed" | "closes-early" | "late" | null;
}

export interface Simulation {
  order: number[];
  visits: ScheduledVisit[];
  travelMin: number;
  waitMin: number;
  finishMin: number;
  overMin: number;
  crowdCost: number;
  issues: number;
  cost: number;
}

const ISSUE_PENALTY = 600;
const OVERTIME_WEIGHT = 2;
/** Per minute late for a fixed time, on top of the issue penalty. */
const LATE_WEIGHT = 20;
/** Minutes of slack before a fixed time counts as missed. */
const LATE_GRACE = 5;
/** Per minute a meal starts after its window. */
const SOFT_LATE_WEIGHT = 3;
const NODE_BUDGET = 2_000_000;

interface Step {
  arriveMin: number;
  startMin: number;
  endMin: number;
  waitMin: number;
  crowd: number | null;
  issue: ScheduledVisit["issue"];
  /** Everything this step adds to the cost except travel. */
  cost: number;
}

function visitAt(input: OptimizeInput, index: number, arriveMin: number): Step {
  const window = input.windows[index];
  const visit = input.visitMin[index];
  const fixed = input.fixedStart?.[index] ?? null;
  const soft = input.softWindow?.[index] ?? null;
  let startMin = arriveMin;
  let issue: Step["issue"] = null;
  let penalty = 0;
  if (fixed !== null) {
    startMin = Math.max(startMin, fixed);
    if (arriveMin > fixed + LATE_GRACE) {
      issue = "late";
      penalty += ISSUE_PENALTY + (arriveMin - fixed) * LATE_WEIGHT;
    }
  }
  if (soft) {
    startMin = Math.max(startMin, soft[0]);
    if (startMin > soft[1]) penalty += (startMin - soft[1]) * SOFT_LATE_WEIGHT;
  }
  if (window === null) {
    issue = "closed";
  } else if (window !== "always") {
    const [open, close] = window;
    if (startMin < open) startMin = open;
    if (startMin + visit > close) issue ??= "closes-early";
  }
  if (issue === "closed" || issue === "closes-early") penalty += ISSUE_PENALTY;
  const endMin = startMin + visit;
  const waitMin = startMin - arriveMin;
  const levels = input.levels[index];
  const crowd = levels ? levelDuring(levels, startMin, endMin) : null;
  const cost = waitMin + (crowd ?? 0) * visit * input.crowdWeight + penalty;
  return { arriveMin, startMin, endMin, waitMin, crowd, issue, cost };
}

/** Where the day physically is: -1 = the origin (or nowhere yet). */
type Loc = number;

/** Minutes to reach stop j from the last real place, plus a breather between places. */
function legTo(input: OptimizeInput, loc: Loc, prev: number | null, j: number): number {
  if (input.floating?.[j]) return 0;
  const travel = loc === -1 ? (input.fromOrigin?.[j] ?? 0) : input.travel[loc][j];
  const breather = prev !== null && !input.floating?.[prev] ? (input.bufferMin ?? 0) : 0;
  return travel + breather;
}

const nextLoc = (input: OptimizeInput, loc: Loc, j: number): Loc => (input.floating?.[j] ? loc : j);

/** Run one order through the day. */
export function simulate(input: OptimizeInput, order: number[]): Simulation {
  let t = input.startMin;
  let loc: Loc = -1;
  let travelMin = 0;
  let waitMin = 0;
  let crowdCost = 0;
  let issues = 0;
  let cost = 0;
  const visits: ScheduledVisit[] = [];
  order.forEach((index, i) => {
    const leg = legTo(input, loc, i === 0 ? null : order[i - 1], index);
    travelMin += leg;
    const step = visitAt(input, index, t + leg);
    visits.push({ index, ...step });
    waitMin += step.waitMin;
    crowdCost += (step.crowd ?? 0) * input.visitMin[index];
    if (step.issue) issues++;
    cost += leg + step.cost;
    t = step.endMin;
    loc = nextLoc(input, loc, index);
  });
  if (input.toOrigin && loc !== -1) {
    const back = input.toOrigin[loc];
    travelMin += back;
    cost += back;
    t += back;
  }
  const overMin = Math.max(0, t - input.endMin);
  cost += overMin * OVERTIME_WEIGHT;
  return { order, visits, travelMin, waitMin, finishMin: t, overMin, crowdCost, issues, cost };
}

/** Nearest-next from the start: a cheap first answer that lets the search prune from the outset. */
function greedy(input: OptimizeInput): number[] {
  const n = input.visitMin.length;
  const left = new Set(Array.from({ length: n }, (_, i) => i));
  const order: number[] = [];
  let t = input.startMin;
  let loc: Loc = -1;
  let prev: number | null = null;
  while (left.size) {
    let best = -1;
    let bestCost = Infinity;
    let bestEnd = t;
    for (const j of left) {
      const leg = legTo(input, loc, prev, j);
      const step = visitAt(input, j, t + leg);
      if (leg + step.cost < bestCost) {
        bestCost = leg + step.cost;
        best = j;
        bestEnd = step.endMin;
      }
    }
    order.push(best);
    left.delete(best);
    t = bestEnd;
    loc = nextLoc(input, loc, best);
    prev = best;
  }
  return order;
}

/** Extra travel, beyond the most direct order, that a quieter order may cost before it counts as zig-zagging. */
const ZIGZAG_MIN = 15;
const ZIGZAG_SHARE = 0.25;

/**
 * The best order, without zig-zagging across town to dodge crowds: when the crowd-aware order
 * travels much further than the most direct one (by over 15 minutes and a quarter), and the direct
 * one keeps every opening hour and time as well, the direct one wins. Crowds still choose between
 * orders that are about as direct.
 */
export function optimize(input: OptimizeInput): { best: Simulation; exhaustive: boolean } {
  const quiet = search(input);
  // No second search when it can't matter: crowds ignored, or so little travel that the direct
  // order can't save more than the threshold.
  if (!input.crowdWeight || quiet.best.travelMin <= ZIGZAG_MIN) return quiet;
  const direct = search({ ...input, crowdWeight: 0 });
  const extra = quiet.best.travelMin - direct.best.travelMin;
  if (extra <= Math.max(ZIGZAG_MIN, direct.best.travelMin * ZIGZAG_SHARE)) return quiet;
  if (direct.best.issues > quiet.best.issues || direct.best.overMin > quiet.best.overMin) return quiet;
  // Scored with the real crowd weight, so the plan's numbers stay comparable.
  return { best: simulate(input, direct.best.order), exhaustive: quiet.exhaustive && direct.exhaustive };
}

function search(input: OptimizeInput): { best: Simulation; exhaustive: boolean } {
  const n = input.visitMin.length;
  if (n === 0) return { best: simulate(input, []), exhaustive: true };

  let best = simulate(input, greedy(input));
  let nodes = 0;
  let exhaustive = true;
  const order: number[] = [];
  const used = new Array<boolean>(n).fill(false);

  // Overtime is only known at the end, and the return leg only once the last stop is set,
  // so the bound is the partial cost alone. Both are non-negative, so it stays a lower bound.
  const walk = (t: number, cost: number, loc: Loc) => {
    if (cost >= best.cost) return;
    if (++nodes > NODE_BUDGET) {
      exhaustive = false;
      return;
    }
    if (order.length === n) {
      const full = simulate(input, order);
      if (full.cost < best.cost) best = { ...full, order: [...order] };
      return;
    }
    const prev = order.length ? order[order.length - 1] : null;
    for (let j = 0; j < n; j++) {
      if (used[j]) continue;
      const leg = legTo(input, loc, prev, j);
      const step = visitAt(input, j, t + leg);
      used[j] = true;
      order.push(j);
      walk(step.endMin, cost + leg + step.cost, nextLoc(input, loc, j));
      order.pop();
      used[j] = false;
      if (!exhaustive) return;
    }
  };
  walk(input.startMin, 0, -1);
  if (!exhaustive) best = improve(input, best);
  return { best, exhaustive };
}

/**
 * When the search runs out of budget, polish what it found: move each stop to
 * every other position and keep any move that lowers the cost, until none does.
 */
function improve(input: OptimizeInput, start: Simulation): Simulation {
  let best = start;
  for (let improved = true; improved; ) {
    improved = false;
    for (let from = 0; from < best.order.length; from++) {
      for (let to = 0; to < best.order.length; to++) {
        if (to === from) continue;
        const order = [...best.order];
        const [moved] = order.splice(from, 1);
        order.splice(to, 0, moved);
        const next = simulate(input, order);
        if (next.cost < best.cost - 1e-9) {
          best = next;
          improved = true;
        }
      }
    }
  }
  return best;
}

/** How strongly each preference trades crowd exposure against minutes of travel. */
export const CROWD_WEIGHTS = { avoid: 1.2, balanced: 0.5, ignore: 0 } as const;
