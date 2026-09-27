"use client";

import { Link2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button, cn } from "../bridge/ui";
import { AskRoam } from "./AskRoam";
import { AvatarStack } from "./Avatar";
import { ConsensusBar } from "./ConsensusBar";
import { missingFor, type FreeWindow } from "../core/availability";
import { DayBuilder } from "./DayBuilder";
import { FreeTimeCard } from "./FreeTimeCard";
import { GettingHomePanel } from "./GettingHomePanel";
import { GroupMapPanel } from "./GroupMapPanel";
import { IdeasPanel } from "./IdeasPanel";
import { JoinCard } from "./JoinCard";
import { PlacesPanel } from "./PlacesPanel";
import { StartPointCard } from "./StartPointCard";
import { useTripRoom, type Viewer } from "./useTripRoom";

type Tab = "places" | "ideas" | "day";

export function TripRoom({ id, viewer = null }: { id: string; viewer?: Viewer | null }) {
  const room = useTripRoom(id, viewer);
  const [tab, setTab] = useState<Tab>("places");
  const { trip, me, draft, actions } = room;

  if (room.status === "missing") {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-sm text-muted-foreground">This trip has expired or the link is wrong.</p>
        <Link href="/start" className="mt-3 inline-block text-sm font-medium text-brand hover:underline">
          Start a new trip room
        </Link>
      </main>
    );
  }
  if (!trip) return <main className="mx-auto max-w-md px-4 py-16 text-center text-sm text-muted-foreground">Loading trip…</main>;

  const people = Object.entries(trip.members)
    .sort((a, b) => a[1].joinedAt - b[1].joinedAt)
    .map(([mid, m]) => ({ id: mid, ...m }));
  const host = trip.members[trip.hostId]?.name ?? "A friend";
  const emoji = (mid: string) => trip.members[mid]?.avatar.emoji ?? "?";
  const free: Record<string, FreeWindow> = Object.fromEntries(Object.entries(trip.members).flatMap(([mid, m]) => (m.free ? [[mid, m.free]] : [])));
  const dateLabel = new Date(`${trip.settings.date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });

  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-4 px-4 pt-6 pb-36">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">{dateLabel}</p>
          <h1 className="font-display text-4xl leading-tight sm:text-5xl">{trip.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <AvatarStack people={people} size="md" />
            <span>
              {people.length} {people.length === 1 ? "person" : "people"} · hosted by {host}
            </span>
          </div>
        </div>
        <Button size="sm" variant="outline" className="rounded-full" onClick={actions.copyInvite}>
          <Link2 aria-hidden /> {room.copied ? "Link copied" : "Copy invite link"}
        </Button>
      </header>

      {(room.offline || room.error || room.rememberWarning) && (
        <div className="flex flex-col gap-1 text-xs">
          {room.offline && <p className="text-muted-foreground">Reconnecting…</p>}
          {room.rememberWarning && <p className="text-muted-foreground">You&apos;re in, but this browser won&apos;t remember you after you close it.</p>}
          {room.error && (
            <p role="alert" className="text-sm text-destructive">
              {room.error}
            </p>
          )}
        </div>
      )}

      {!me && !room.locked && <JoinCard hostName={host} accountName={viewer?.name ?? null} onJoin={actions.join} />}

      <div className="flex gap-1 rounded-full border border-border bg-card p-1 lg:hidden" role="tablist" aria-label="Trip room sections">
        {(["places", "ideas", "day"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn("flex-1 rounded-full py-1.5 text-sm font-medium transition", tab === t ? "bg-foreground text-background" : "text-muted-foreground")}
          >
            {t === "places" ? `Places · ${trip.candidates.length}` : t === "ideas" ? `Ideas · ${trip.ideas.length}` : "Map & day"}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start lg:[grid-auto-rows:min-content]">
        <div className={cn("flex flex-col gap-4", tab !== "places" && "hidden lg:flex")}>
          {me && !room.locked && (
            <StartPointCard start={me.start} onSet={actions.setStart} added={people.filter((p) => p.start).length} total={people.length} />
          )}
          {me && !room.locked && <FreeTimeCard meId={me.id} people={people.map((p) => ({ id: p.id, name: p.name, avatar: p.avatar, free: p.free ?? null }))} group={trip.window} onSet={actions.setFree} />}
          {me && !room.locked && <AskRoam tripId={id} memberId={me.id} addedKeys={new Set(trip.candidates.map((c) => c.stop.key))} onAdd={actions.suggest} />}
          <PlacesPanel trip={trip} memberId={me?.id ?? null} locked={room.locked} onVote={actions.vote} onSuggest={actions.suggest} onRemove={actions.remove} />
        </div>
        <div className={cn("lg:col-start-1", tab !== "ideas" && "hidden lg:block")}>
          <IdeasPanel trip={trip} memberId={me?.id ?? null} onPost={actions.postIdea} onVote={actions.voteIdea} onToPlace={actions.ideaToPlace} tripId={id} />
        </div>
        <div className={cn("flex flex-col gap-4 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start", tab !== "day" && "hidden lg:flex")}>
          <GroupMapPanel trip={trip} plan={draft.plan} memberId={me?.id ?? null} onSuggest={actions.suggest} />
          <DayBuilder trip={trip} plan={draft.plan} updating={draft.updating || room.busy} error={draft.error} canEdit={!!me} whoMisses={(s, e) => missingFor(free, s, e).map(emoji)} onSave={actions.saveItinerary} onRegenerate={actions.regenerate} />
          <GettingHomePanel trip={trip} tripId={id} plan={draft.plan} />
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-6xl">
          <ConsensusBar trip={trip} memberId={me?.id ?? null} hasDraft={!!trip.consensus.signature} busy={room.busy} onConfirm={actions.confirm} onDeadline={actions.setDeadline} />
        </div>
      </div>
    </main>
  );
}
