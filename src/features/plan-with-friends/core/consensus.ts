import type { PlanRequest } from "../bridge/index";

/** "everyone-in": every member but the host is in, so the host can approve with the whole group behind it. */
export type ConsensusReason = "no-draft" | "waiting" | "everyone-in";

/**
 * Where the group stands on the current day. Members say "I'm in"; only the
 * host's approval locks the plan (see the service), so nothing here decides.
 */
export interface Consensus {
  signature: string | null;
  confirmed: string[];
  /** Confirmed an earlier version of the day; they need to look again. */
  stale: string[];
  pending: string[];
  /** Members asked for an I'm in: everyone but the host. */
  total: number;
  reason: ConsensusReason;
}

/** cyrb53: a fast, deterministic hash that runs the same on the server and in the browser. */
export function hashOf(value: unknown): string {
  return hash(JSON.stringify(value));
}

function hash(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

export function draftSignature(request: PlanRequest): string {
  return hash(JSON.stringify(request));
}

/** `members` excludes the host, who approves rather than saying I'm in. */
export function consensus(input: { members: string[]; confirmations: Record<string, string>; draft: PlanRequest | null }): Consensus {
  const { members, confirmations, draft } = input;
  const total = members.length;
  if (!draft) return { signature: null, confirmed: [], stale: [], pending: [...members], total, reason: "no-draft" };
  const signature = draftSignature(draft);
  const confirmed = members.filter((m) => confirmations[m] === signature);
  const stale = members.filter((m) => confirmations[m] !== undefined && confirmations[m] !== signature);
  const pending = members.filter((m) => confirmations[m] !== signature);
  return { signature, confirmed, stale, pending, total, reason: pending.length ? "waiting" : "everyone-in" };
}
