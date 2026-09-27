"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type SubmitEvent } from "react";
import { nycNowMin, nycToday } from "../bridge/index";
import { Button, Input } from "../bridge/ui";
import { defaultAvatar, type Avatar } from "../core/avatars";
import type { Trip } from "../core/types";
import { AvatarPicker } from "./AvatarPicker";
import { tripApi } from "./client";
import { storeIdentity } from "./local";

/** Late in the day, a new room is more likely for tomorrow. */
function suggestedDate(): string {
  const today = nycToday();
  if (nycNowMin() < 15 * 60) return today;
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function StartRoom({ code, group }: { code: string | null; group: string | null }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<Avatar>(() => defaultAvatar("host"));
  const [date, setDate] = useState(suggestedDate);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { trip, memberId } = await tripApi<{ trip: Trip; memberId: string }>("", code ? { name, avatar, code } : { name, avatar, date });
      if (!storeIdentity(trip.id, { memberId })) {
        setError("This browser can't remember you. Open Roam in a normal (not private) window to start a room.");
        setBusy(false);
        return;
      }
      router.replace(`/trip/${trip.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start the trip.");
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 px-4 py-10">
      <div>
        <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">{group === "family" ? "Family trip room" : "Trip room"}</p>
        <h1 className="font-display text-4xl leading-tight">Plan it together</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {code ? "Your plan's places go in as the first ideas. " : ""}Friends join from your link, suggest places and vote. The day is set when everyone taps I&apos;m in.
        </p>
      </div>
      <form onSubmit={start} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4">
        <AvatarPicker value={avatar} onChange={setAvatar} />
        <label className="flex flex-col gap-1 text-sm font-medium">
          Your name
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} autoFocus required />
        </label>
        {!code && (
          <label className="flex flex-col gap-1 text-sm font-medium">
            Which day?
            <Input type="date" value={date} min={nycToday()} onChange={(e) => setDate(e.target.value)} required />
          </label>
        )}
        <Button type="submit" disabled={busy || !name.trim()} className="h-10 rounded-full">
          {busy ? "Starting…" : "Start the trip room"}
        </Button>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </form>
      <Link href="/start" className="text-center text-xs text-muted-foreground hover:text-foreground">
        ← Back to who&apos;s coming
      </Link>
    </main>
  );
}
