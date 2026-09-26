"use client";

import { useState } from "react";
import { Check, UserRound } from "lucide-react";
import { Segmented } from "@/components/ui/segmented";
import { DEFAULT_PROFILE, GROUP, INTERESTS, PACE, WALK_LIMITS } from "@/lib/plan/profile";
import type { Group, Interest, Pace, Profile } from "@/lib/plan/types";
import { cn } from "@/lib/utils";

/** One line that says what the profile is doing, so it can stay collapsed. */
export function profileSummary(p: Profile): string {
  const parts = [PACE[p.pace].label, GROUP[p.group].label, p.walkMax ? `walks up to ${p.walkMax} min` : null, ...p.interests.map((i) => INTERESTS[i].label)];
  return parts.filter(Boolean).join(" · ");
}

/**
 * How this traveler likes to travel. Every choice changes the plan: pace sets
 * visit lengths and breathers, the group sets a walking limit, interests pick
 * the suggestions.
 */
export function ProfileCard({ profile, onChange }: { profile: Profile; onChange: (p: Profile) => void }) {
  const set = <K extends keyof Profile>(key: K, value: Profile[K]) => onChange({ ...profile, [key]: value });
  // Open for a first-time visitor, collapsed to its summary once set; after that the reader decides.
  const [open, setOpen] = useState(() => JSON.stringify(profile) === JSON.stringify(DEFAULT_PROFILE));

  return (
    <details className="group rounded-2xl border border-border bg-card" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 select-none [&::-webkit-details-marker]:hidden">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
          <UserRound className="size-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Your travel style</span>
          <span className="block truncate text-xs text-muted-foreground">{profileSummary(profile)}</span>
        </span>
        <span className="text-xs font-medium text-brand group-open:hidden">Edit</span>
      </summary>

      <div className="space-y-4 border-t border-border px-4 pt-4 pb-5">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">Pace</span>
          <Segmented
            label="Pace"
            value={profile.pace}
            onChange={(v: Pace) => set("pace", v)}
            options={(Object.keys(PACE) as Pace[]).map((p) => ({ value: p, label: PACE[p].label }))}
            className="w-fit"
          />
          <span className="text-[11px] text-muted-foreground">{PACE[profile.pace].hint}</span>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">Who&apos;s coming</span>
          <Segmented
            label="Who's coming"
            value={profile.group}
            // A group comes with a sensible walking limit; the reader can change it just below.
            onChange={(v: Group) => onChange({ ...profile, group: v, walkMax: GROUP[v].walkMax })}
            options={(Object.keys(GROUP) as Group[]).map((g) => ({ value: g, label: GROUP[g].label }))}
            className="w-fit max-w-full overflow-x-auto"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">Longest walk before taking the subway</span>
          <Segmented
            label="Longest walk"
            value={String(profile.walkMax ?? "none")}
            onChange={(v: string) => set("walkMax", v === "none" ? null : Number(v))}
            options={WALK_LIMITS.map((w) => ({ value: String(w.value ?? "none"), label: w.label }))}
            className="w-fit"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">What you&apos;re into</span>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(INTERESTS) as Interest[]).map((i) => {
              const on = profile.interests.includes(i);
              return (
                <button
                  key={i}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set("interests", on ? profile.interests.filter((x) => x !== i) : [...profile.interests, i])}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition",
                    on ? "border-brand bg-brand-soft text-brand" : "border-border bg-background text-muted-foreground hover:text-foreground",
                  )}
                >
                  {on && <Check className="size-3" aria-hidden />}
                  {INTERESTS[i].label}
                </button>
              );
            })}
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">Saved on this device and included when you share a plan.</p>
      </div>
    </details>
  );
}
