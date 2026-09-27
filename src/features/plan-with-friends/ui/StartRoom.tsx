"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type SubmitEvent } from "react";
import { nycNowMin, nycToday } from "../bridge/index";
import { AppBar } from "../bridge/ui";
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
        setError("This browser can't remember you. Open PlaNYt in a normal (not private) window to start a room.");
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
    <main className="ed-app ed-paper tr-page">
      <AppBar home="/plan" />
      <section className="ed-gut tr-spread">
        <div>
          <p className="ed-mono ed-kicker">{group === "family" ? "Family trip room" : "Trip room"}</p>
          <h1 className="tr-display">Plan it <em>together.</em></h1>
          <p className="ed-dek">
            {code ? "Your plan's places go in as the first ideas. " : ""}Friends join from your link, suggest places and vote. The day is set when everyone taps I&apos;m in.
          </p>
          <ol className="tr-steps">
            <li>
              <div className="ed-bullet">1</div>
              <strong>Share your link</strong>
            </li>
            <li>
              <div className="ed-bullet">2</div>
              <strong>Everyone suggests places and votes</strong>
            </li>
            <li>
              <div className="ed-bullet">3</div>
              <strong>The day is set when everyone taps I&apos;m in</strong>
            </li>
          </ol>
        </div>

        <form onSubmit={start} className="tr-form">
          <AvatarPicker value={avatar} onChange={setAvatar} />
          <div className="ed-field">
            <label htmlFor="name">Your name</label>
            <input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={30}
              autoFocus
              required
            />
          </div>
          {!code && (
            <div className="ed-field">
              <label htmlFor="date">Which day?</label>
              <input
                id="date"
                type="date"
                value={date}
                min={nycToday()}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
          )}
          <button type="submit" disabled={busy || !name.trim()} className="ed-btn ed-btn--block">
            {busy ? "Starting…" : "Start the trip room"}
          </button>
          {error && <p role="alert" className="ed-alert">{error}</p>}
        </form>
      </section>

      <Link href="/start" className="ed-textbtn ed-mono tr-back">
        ← Back to who&apos;s coming
      </Link>
    </main>
  );
}
