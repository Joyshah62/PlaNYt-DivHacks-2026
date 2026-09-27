"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import type { Trip } from "../core/types";
import { AvatarStack } from "./Avatar";

function Confetti() {
  const bits = Array.from({ length: 18 }, (_, i) => i);
  return (
    <span aria-hidden className="tr-confetti">
      {bits.map((i) => (
        <span
          key={i}
          className="tr-confetti-bit"
          style={{
            left: `${5 + i * 5.2}%`,
            background: i % 3 ? "var(--ink)" : "var(--red)",
            animationDuration: `${0.9 + (i % 4) * 0.2}s`,
            animationDelay: `${(i % 6) * 0.08}s`,
          }}
        />
      ))}
    </span>
  );
}

/**
 * The bar along the bottom. Members say "I'm in" to the day as it is; the host
 * sees who's in and approves, which makes the day final and texts it to everyone.
 */
export function ConsensusBar({
  trip,
  memberId,
  hasDraft,
  busy,
  onConfirm,
  onApprove,
}: {
  trip: Trip;
  memberId: string | null;
  hasDraft: boolean;
  busy: boolean;
  onConfirm: (on: boolean) => void;
  onApprove: () => void;
}) {
  const c = trip.consensus;
  const people = Object.entries(trip.members)
    .sort((a, b) => a[1].joinedAt - b[1].joinedAt)
    .map(([id, m]) => ({ id, ...m }));
  const host = trip.members[trip.hostId]?.name ?? "The host";
  const isHost = !!memberId && memberId === trip.hostId;
  const mine = !!memberId && c.confirmed.includes(memberId);
  const staleMine = !!memberId && c.stale.includes(memberId);
  const waitingOn = c.pending.map((id) => trip.members[id]?.avatar.emoji).filter(Boolean).join(" ");
  const inCount = `${c.confirmed.length} of ${c.total} ${c.total === 1 ? "is" : "are"} in`;

  if (trip.lockedCode) {
    return (
      <div className="tr-consensus tr-consensus-locked">
        <Confetti />
        <AvatarStack people={people} />
        <p className="tr-consensus-content tr-consensus-status">
          <strong>{isHost ? "You approved the plan 🎉" : `${host} approved the plan 🎉`}</strong>
          <span className="ed-muted"> This is the day. Everyone with a phone number on their account gets it by text.</span>
        </p>
        <Link href={`/plan?plan=${trip.lockedCode}`} className="ed-btn ed-small">
          Open in planner →
        </Link>
      </div>
    );
  }

  const status = !hasDraft
    ? "Vote for a place first."
    : isHost
      ? c.total === 0
        ? "Invite friends, or approve the plan when it looks right."
        : c.pending.length
          ? `${inCount} · waiting on ${waitingOn}. Approve when you're ready.`
          : "Everyone's in. Approve the plan to make it final."
      : staleMine
        ? "The day changed. Tap I'm in again if it still works for you."
        : mine
          ? `You're in. ${host} approves the final plan.`
          : `Tap I'm in if this day works for you. ${host} approves the final plan.`;

  function approve() {
    // Approving is final for everyone, so a day not everyone has seen gets a second look.
    if (c.pending.length && !window.confirm(`${c.pending.length === 1 ? "One person hasn't" : `${c.pending.length} people haven't`} said I'm in yet. Approve the plan anyway? It will be final, and everyone gets it by text.`)) return;
    onApprove();
  }

  return (
    <div className="tr-consensus">
      <AvatarStack people={people} dimmed={c.pending} />
      <div className="tr-consensus-content">
        <p className="tr-consensus-status">{status}</p>
        {!isHost && hasDraft && c.total > 0 && <p className="tr-consensus-note">{inCount}</p>}
      </div>
      {isHost ? (
        <button type="button" onClick={approve} disabled={busy || !hasDraft} className="tr-in">
          <Check className="size-4" aria-hidden /> Approve plan
        </button>
      ) : (
        memberId && (
          <button type="button" onClick={() => onConfirm(!mine)} disabled={busy || (!mine && !hasDraft)} aria-pressed={mine} className={`tr-in ${mine ? "on" : ""}`}>
            {mine && <Check className="size-4" aria-hidden />} I&apos;m in
          </button>
        )
      )}
    </div>
  );
}
