import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { AppBar } from "@/components/editorial/AppBar";
import { edFonts } from "@/components/editorial/fonts";
import { conversationOwner, recentConversations } from "@/lib/chat/conversations";
import { db } from "@/lib/db";
import { BRAND } from "@/lib/plan/display";
import type { SavedPlan } from "@/lib/plan/share";
import { requireTraveler } from "@/lib/session";
import { memberIdFor } from "@/features/plan-with-friends/server/member";
import { getTripStore } from "@/features/plan-with-friends/server/store";
import "./trips.css";

export const metadata: Metadata = {
  title: `Your trips · ${BRAND.name}`,
  description: "The days you've saved, your trip rooms, and your conversations with Roam AI.",
};

const when = (date: Date | string) =>
  new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" });
const dayOf = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

/** Everything the account keeps: saved days, trip rooms and past chats, on any device. */
export default async function TripsPage() {
  const session = await requireTraveler("/trips");
  const owner = conversationOwner(session.user.id, "");
  // One store failing leaves its section empty rather than the page broken.
  const [saved, rooms, chats] = await Promise.all([
    db.collection<SavedPlan & { owner: string }>("savedTrips")
      .find({ owner }, { projection: { _id: 0, owner: 0 } }).sort({ savedAt: -1 }).limit(30).toArray()
      .catch(() => [] as SavedPlan[]),
    getTripStore().mine(memberIdFor(session.user.id)).catch(() => []),
    recentConversations(owner).catch(() => []),
  ]);

  return (
    <div className={`ed ${edFonts}`}>
      <main className="ed-app ed-paper tp">
        <AppBar home="/plan">
          <Link href="/plan" className="ed-navlink ed-mono">
            Plan a day
          </Link>
        </AppBar>
        <header className="tp-head">
          <p className="ed-mono ed-kicker">Your account · {session.user.name || session.user.email}</p>
          <h1 className="tp-title">
            Your trips, <em>and what you asked.</em>
          </h1>
          <p className="ed-dek">The days you&apos;ve saved, the rooms you&apos;ve planned with friends, and your conversations with Roam AI.</p>
        </header>

        <div className="ed-gut tp-grid">
          <div className="tp-col">
            <section aria-labelledby="saved-heading" id="saved" className="tp-section">
              <h2 id="saved-heading" className="tp-h2">
                Saved <em>trips</em> <span className="ed-mono ed-muted">{saved.length}</span>
              </h2>
              {saved.length ? (
                <ul className="tp-list">
                  {saved.map((p) => (
                    <li key={p.id}>
                      <Link href={`/plan?plan=${p.code}`} className="tp-item">
                        <span className="tp-name">{p.title}</span>
                        <span className="ed-mono ed-muted">Saved {when(p.savedAt)}</span>
                        <ArrowRight className="tp-arrow" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="tp-empty">
                  Nothing saved yet. Plan a day and tap Save, or ask Roam AI to save it. <Link href="/plan" className="tp-link">Plan a day</Link>
                </p>
              )}
            </section>

            <section aria-labelledby="rooms-heading" id="rooms" className="tp-section">
              <h2 id="rooms-heading" className="tp-h2">
                Trip <em>rooms</em> <span className="ed-mono ed-muted">{rooms.length}</span>
              </h2>
              {rooms.length ? (
                <ul className="tp-list">
                  {rooms.map((t) => (
                    <li key={t.id}>
                      <Link href={`/trip/${t.id}`} className="tp-item">
                        <span className="tp-name">{t.title}</span>
                        <span className="ed-mono ed-muted">
                          {dayOf(t.date)} · {t.members} {t.members === 1 ? "person" : "people"}
                          {t.hosting ? " · hosting" : ""} · {t.decided ? <><Check className="tp-inline" aria-hidden /> Decided</> : "Voting"}
                        </span>
                        <ArrowRight className="tp-arrow" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="tp-empty">
                  No trip rooms yet. <Link href="/start" className="tp-link">Start one</Link> and everyone suggests places and votes.
                </p>
              )}
            </section>
          </div>

          <section aria-labelledby="chats-heading" id="chats" className="tp-section tp-col">
            <h2 id="chats-heading" className="tp-h2">
              Conversations <em>with Roam AI</em> <span className="ed-mono ed-muted">{chats.length}</span>
            </h2>
            {chats.length ? (
              <ul className="tp-list">
                {chats.map((c) => {
                  const first = c.messages.find((m) => m.role === "user")?.text ?? "Conversation";
                  return (
                    <li key={c.conversationId}>
                      <details className="tp-chat">
                        <summary className="tp-item">
                          <span className="tp-name">{first}</span>
                          <span className="ed-mono ed-muted">
                            {c.trip?.title ?? "A trip"} · {when(c.updatedAt)} · {c.messages.length} messages
                          </span>
                        </summary>
                        <ol className="tp-transcript" aria-label="Transcript">
                          {c.messages.map((m, i) => (
                            <li key={i} className={m.role === "user" ? "user" : undefined}>
                              <span className="ed-mono ed-muted">{m.role === "user" ? "You" : "Roam AI"}</span>
                              <p>{m.text}</p>
                            </li>
                          ))}
                        </ol>
                        {c.trip && (
                          <p className="tp-actions">
                            <Link href={`/plan?plan=${c.trip.code}&chat=${c.conversationId}`} className="ed-btn">
                              Continue this chat <ArrowRight aria-hidden />
                            </Link>
                            <Link href={`/plan?plan=${c.trip.code}`} className="ed-btn ed-btn--ghost">
                              Open the trip
                            </Link>
                          </p>
                        )}
                      </details>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="tp-empty">No conversations yet. Plan a day, then ask Roam AI to find food, swap a stop or slow the day down.</p>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
