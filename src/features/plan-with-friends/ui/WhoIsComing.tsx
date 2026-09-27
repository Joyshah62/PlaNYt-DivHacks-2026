"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DEFAULT_PROFILE, parseProfile, readProfileRaw, storeProfile, type Profile } from "../bridge/index";
import { cn } from "../bridge/ui";

type Choice = "solo" | "couple" | "friends" | "family" | "team";

const CARDS: { id: Choice; emoji: string; label: string; hint: string }[] = [
  { id: "solo", emoji: "🙋", label: "Just me", hint: "Plan my day" },
  { id: "couple", emoji: "👫", label: "Two of us", hint: "Plan our day" },
  { id: "friends", emoji: "🎉", label: "Friends", hint: "Decide together" },
  { id: "family", emoji: "👪", label: "Family", hint: "Kid-friendly pace" },
  { id: "team", emoji: "💼", label: "Work team", hint: "Decide together" },
];

/** Roam's first question. Embed it anywhere; it routes people to the planner or a trip room. */
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
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {CARDS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => pick(c.id)}
            aria-pressed={c.id === "family" && family}
            className={cn(
              "group flex flex-col items-center gap-1 rounded-2xl border bg-card px-3 py-4 last:col-span-2 sm:last:col-span-1 text-center transition hover:-translate-y-0.5 hover:border-brand/60 hover:shadow-md",
              c.id === "family" && family ? "border-brand bg-brand-soft" : "border-border",
            )}
          >
            <span className="text-3xl transition group-hover:scale-110" aria-hidden>
              {c.emoji}
            </span>
            <span className="text-sm font-semibold">{c.label}</span>
            <span className="text-[11px] text-muted-foreground">{c.hint}</span>
          </button>
        ))}
      </div>
      {family && (
        <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-border bg-card p-3 text-sm">
          <span className="text-muted-foreground">How do you want to plan?</span>
          <button type="button" onClick={() => planAlone("family")} className="rounded-full border border-border px-3 py-1.5 font-medium hover:bg-muted">
            I&apos;ll plan it myself
          </button>
          <button type="button" onClick={() => router.push("/trip/start?group=family")} className="rounded-full bg-foreground px-3 py-1.5 font-medium text-background hover:bg-foreground/85">
            Plan it together
          </button>
        </div>
      )}
    </div>
  );
}
