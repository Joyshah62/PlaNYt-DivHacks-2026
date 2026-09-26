"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type SubmitEvent } from "react";
import { Button } from "../bridge/ui";
import { Input } from "../bridge/ui";
import { tripApi } from "./client";
import { storeIdentity } from "./local";
import type { Trip } from "../core/types";

export function TripStart({ code }: { code: string | null }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { trip, memberId } = await tripApi<{ trip: Trip; memberId: string }>("", { name, code, avatar: { emoji: "🦊", color: "orange" } });
      if (!storeIdentity(trip.id, { memberId })) {
        setError("This browser can't save your organizer key. Open Roam in a normal (not private) window to organize a trip.");
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
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4 py-10">
      <h1 className="font-display text-4xl">Plan with friends</h1>
      {code ? (
        <form onSubmit={start} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Friends you invite can suggest places and vote. The day locks when everyone is in.</p>
          <label className="text-sm font-medium" htmlFor="organizer-name">
            Your name
          </label>
          <Input id="organizer-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={30} autoFocus required />
          <Button type="submit" disabled={busy || !name.trim()}>
            {busy ? "Starting…" : "Start the trip"}
          </Button>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">
          Build a day first, then press Plan with friends.{" "}
          <Link href="/plan" className="font-medium text-brand underline-offset-4 hover:underline">
            Go to the planner
          </Link>
        </p>
      )}
    </main>
  );
}
