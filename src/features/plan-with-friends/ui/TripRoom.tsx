"use client";

import { Link2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AppBar, arrowKeys } from "../bridge/ui";
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
      <main className="ed-app ed-paper tr-page">
        <AppBar home="/plan" />
        <section className="ed-gut tr-state">
          <p className="tr-display">This trip has expired or the link is wrong.</p>
          <Link href="/start" className="ed-link">
            Start a new trip room
          </Link>
        </section>
      </main>
    );
  }
  if (!trip) {
    return (
      <main className="ed-app ed-paper tr-page">
        <AppBar home="/plan" />
        <section className="ed-gut tr-state">
          <p className="ed-mono ed-muted">Loading trip…</p>
        </section>
      </main>
    );
  }

  const people = Object.entries(trip.members)
    .sort((a, b) => a[1].joinedAt - b[1].joinedAt)
    .map(([mid, m]) => ({ id: mid, ...m }));
  const host = trip.members[trip.hostId]?.name ?? "A friend";
  const emoji = (mid: string) => trip.members[mid]?.avatar.emoji ?? "?";
  const free: Record<string, FreeWindow> = Object.fromEntries(Object.entries(trip.members).flatMap(([mid, m]) => (m.free ? [[mid, m.free]] : [])));
  const dateLabel = new Date(`${trip.settings.date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });

  return (
    <main className="ed-app ed-paper tr-page tr-room">
      <AppBar home="/plan">
        <button type="button" className="ed-btn ed-btn--ghost" onClick={actions.copyInvite}>
          <Link2 aria-hidden /> {room.copied ? "Link copied" : "Copy invite link"}
        </button>
      </AppBar>

      <header className="tr-head">
        <p className="ed-mono ed-kicker">{dateLabel}</p>
        <h1 className="tr-display">{trip.title}</h1>
        <div className="tr-who-line">
          <AvatarStack people={people} size="md" />
          <span className="ed-mono ed-muted">
            {people.length} {people.length === 1 ? "person" : "people"} · hosted by {host}
          </span>
        </div>
      </header>

      {(room.offline || room.error || room.rememberWarning) && (
        <div className="ed-gut tr-status">
          {room.offline && <p className="ed-small ed-muted">Reconnecting…</p>}
          {room.rememberWarning && <p className="ed-small ed-muted">You&apos;re in, but this browser won&apos;t remember you after you close it.</p>}
          {room.error && <p role="alert" className="ed-alert">{room.error}</p>}
        </div>
      )}

      {!me && !room.locked && <JoinCard hostName={host} accountName={viewer?.name ?? null} onJoin={actions.join} />}

      <div className="ed-tabs tr-tabs" role="tablist" aria-label="Trip room sections" onKeyDown={(e) => arrowKeys(e, '[role="tab"]', true)}>
        {(["places", "ideas", "day"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className="ed-tab"
          >
            {t === "places" ? `Places · ${trip.candidates.length}` : t === "ideas" ? `Ideas · ${trip.ideas.length}` : "Map & day"}
          </button>
        ))}
      </div>

      <div className="tr-grid" data-tab={tab}>
        <div className="tr-col tr-col-places">
          {me && !room.locked && (
            <StartPointCard start={me.start} onSet={actions.setStart} added={people.filter((p) => p.start).length} total={people.length} />
          )}
          {me && !room.locked && <FreeTimeCard meId={me.id} people={people.map((p) => ({ id: p.id, name: p.name, avatar: p.avatar, free: p.free ?? null }))} group={trip.window} onSet={actions.setFree} />}
          {me && !room.locked && <AskRoam tripId={id} memberId={me.id} addedKeys={new Set(trip.candidates.map((c) => c.stop.key))} onAdd={actions.suggest} />}
          <PlacesPanel trip={trip} memberId={me?.id ?? null} locked={room.locked} onVote={actions.vote} onSuggest={actions.suggest} onRemove={actions.remove} />
        </div>
        <div className="tr-col tr-col-ideas">
          <IdeasPanel trip={trip} memberId={me?.id ?? null} onPost={actions.postIdea} onVote={actions.voteIdea} onToPlace={actions.ideaToPlace} tripId={id} />
        </div>
        <div className="tr-col tr-col-day">
          <GroupMapPanel trip={trip} plan={draft.plan} memberId={me?.id ?? null} onSuggest={actions.suggest} />
          <DayBuilder trip={trip} plan={draft.plan} updating={draft.updating || room.busy} error={draft.error} canEdit={!!me} whoMisses={(s, e) => missingFor(free, s, e).map(emoji)} onSave={actions.saveItinerary} onRegenerate={actions.regenerate} />
          <GettingHomePanel trip={trip} tripId={id} plan={draft.plan} />
        </div>
      </div>

      <div className="tr-dock">
        <ConsensusBar trip={trip} memberId={me?.id ?? null} hasDraft={!!trip.consensus.signature} busy={room.busy} onConfirm={actions.confirm} onDeadline={actions.setDeadline} />
      </div>
    </main>
  );
}
