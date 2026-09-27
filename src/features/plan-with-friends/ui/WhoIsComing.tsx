"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DEFAULT_PROFILE, parseProfile, readProfileRaw, storeProfile, type Profile } from "../bridge/index";

type Choice = "solo" | "couple" | "friends" | "family" | "team";

const CARDS: { id: Choice; emoji: string; label: string; hint: string }[] = [
  { id: "solo", emoji: "🙋", label: "Just me", hint: "Plan my day" },
  { id: "couple", emoji: "👫", label: "Two of us", hint: "Plan our day" },
  { id: "friends", emoji: "🎉", label: "Friends", hint: "Decide together" },
  { id: "family", emoji: "👪", label: "Family", hint: "Kid-friendly pace" },
  { id: "team", emoji: "💼", label: "Work team", hint: "Decide together" },
];

/** PlaNYt's first question. Embed it anywhere; it routes people to the planner or a trip room. */
export function WhoIsComing({ className }: { className?: string }) {
  const router = useRouter();
  const [family, setFamily] = useState(false);

  function planAlone(group: Profile["group"]) {
    const current = parseProfile(readProfileRaw()) ?? DEFAULT_PROFILE;
    storeProfile({ ...current, group });
    router.push("/plan");
  }

  function pick(id: Choice) {
    if (id === "solo" || id === "couple") return planAlone(id);
    if (id === "family") return setFamily(true);
    router.push("/trip/start");
  }

  return (
    <div className={className}>
      <ul className="tr-who">
        {CARDS.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => pick(c.id)}
              aria-pressed={c.id === "family" && family}
              className="tr-who-card"
            >
              <span className="tr-who-card-emoji" aria-hidden>
                {c.emoji}
              </span>
              <span className="tr-who-card-label">{c.label}</span>
              <span className="ed-small ed-muted">{c.hint}</span>
            </button>
          </li>
        ))}
      </ul>
      {family && (
        <div className="tr-who-family">
          <span className="ed-dek">How do you want to plan?</span>
          <button type="button" onClick={() => planAlone("family")} className="ed-btn ed-btn--ghost">
            I&apos;ll plan it myself
          </button>
          <button type="button" onClick={() => router.push("/trip/start?group=family")} className="ed-btn">
            Plan it together
          </button>
        </div>
      )}
    </div>
  );
}
