"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  CircleNotch,
  Coffee,
  Footprints,
  ForkKnife,
  MapTrifold,
  Sparkle,
  Television,
  Umbrella,
  X,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

export interface PresetIdea {
  id: string;
  icon: typeof Coffee;
  label: string;
  badge: string;
  badgeColor: string;
  shortDesc: string;
  text: string;
}

export const PRESET_IDEAS: PresetIdea[] = [
  {
    id: "friends",
    icon: Coffee,
    label: "Friends Walk",
    badge: "Friends",
    badgeColor: "bg-(--friends-orange)/15 text-(--friends-orange) border-(--friends-orange)/35",
    shortDesc: "Central Perk & Bedford St",
    text: "A Friends-themed Saturday: coffee in Greenwich Village, visit Monica's apartment on Bedford St, and an afternoon at Washington Square Park.",
  },
  {
    id: "seinfeld",
    icon: Television,
    label: "Seinfeld Day",
    badge: "Seinfeld",
    badgeColor: "bg-(--seinfeld-blue)/15 text-(--seinfeld-blue) border-(--seinfeld-blue)/35",
    shortDesc: "Monk's Diner & UWS",
    text: "Classic Seinfeld NYC: breakfast at Monk's Diner (Tom's Restaurant) on the Upper West Side, Central Park stroll, and stand-up comedy.",
  },
  {
    id: "himym",
    icon: Umbrella,
    label: "HIMYM Trail",
    badge: "HIMYM",
    badgeColor: "bg-brand/20 text-brand border-brand/35",
    shortDesc: "MacLaren's & Umbrella",
    text: "How I Met Your Mother adventure: Empire State Building, Museum of Natural History, yellow cab ride down Broadway, and evening drinks at MacLaren's.",
  },
  {
    id: "skyline",
    icon: Sparkle,
    label: "Skyline & High Line",
    badge: "Classic",
    badgeColor: "bg-brand/15 text-brand border-brand/35",
    shortDesc: "Top of the Rock & Views",
    text: "A slow Saturday: the Met, skyline view from Top of the Rock, coffee nearby and dinner in the Village.",
  },
  {
    id: "brooklyn",
    icon: Footprints,
    label: "DUMBO & Bridges",
    badge: "Brooklyn",
    badgeColor: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/35",
    shortDesc: "Bridge Walk & Pizza",
    text: "Walk the Brooklyn Bridge into DUMBO, photo on Washington St, pizza at Grimaldi's, Jane's Carousel, and skyline sunset at Brooklyn Bridge Park.",
  },
  {
    id: "broadway",
    icon: ForkKnife,
    label: "Midtown & Speakeasies",
    badge: "Nightlife",
    badgeColor: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/35",
    shortDesc: "Broadway & Cocktails",
    text: "Evening in Midtown: Broadway theater show, walk through Times Square neon, hidden speakeasy cocktails in Hell's Kitchen, and late-night diner pie.",
  },
];

export function LandingPrompt() {
  const router = useRouter();
  const input = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  const [going, setGoing] = useState(false);
  const [activeIdeaIndex, setActiveIdeaIndex] = useState(0);
  const [isFocused, setIsFocused] = useState(false);

  // Cycle through ideas calmly when idle, but freeze on focus so the placeholder never changes when clicked
  useEffect(() => {
    if (isFocused || text) return;
    const timer = setInterval(() => {
      setActiveIdeaIndex((prev) => (prev + 1) % PRESET_IDEAS.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [isFocused, text]);

  function go(customQuery?: string) {
    const q = (customQuery ?? text).trim();
    if (!q || going) return;
    setGoing(true);
    router.push(`/plan?q=${encodeURIComponent(q)}`);
  }

  function handleSelectPreset(preset: PresetIdea) {
    setText(preset.text);
    input.current?.focus();
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        go();
      }}
      className="neo-raised space-y-5 rounded-3xl p-5 sm:p-7 shadow-xl border backdrop-blur-2xl"
    >
      {/* Header with Preset Pills */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <label htmlFor="day-prompt" className="font-display text-sm font-semibold tracking-tight">
            Curated Presets & Custom Planner
          </label>
          {text && (
            <button
              type="button"
              aria-label="Clear prompt"
              onClick={() => {
                setText("");
                input.current?.focus();
              }}
              className="neo-control flex items-center gap-1 rounded-xl px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <X weight="bold" className="size-3.5" aria-hidden />
              <span>Clear</span>
            </button>
          )}
        </div>

        {/* Proper Preset Buttons Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" role="group" aria-label="NYC Preset Itineraries">
          {PRESET_IDEAS.map((idea) => {
            const isSelected = text === idea.text;
            const Icon = isSelected ? Check : idea.icon;
            return (
              <button
                key={idea.id}
                type="button"
                aria-pressed={isSelected}
                disabled={going}
                onClick={() => handleSelectPreset(idea)}
                className={`group flex flex-col items-start rounded-2xl p-2.5 text-left transition-all duration-200 border ${
                  isSelected
                    ? "neo-inset border-brand/60 bg-brand/5 shadow-inner"
                    : "neo-control border-transparent hover:border-border/60"
                }`}
              >
                <div className="flex w-full items-center justify-between gap-1.5">
                  <Icon
                    weight={isSelected ? "bold" : "duotone"}
                    className={`size-4 shrink-0 ${isSelected ? "text-brand" : "text-muted-foreground group-hover:text-brand"}`}
                    aria-hidden
                  />
                  <span className={`rounded-md border px-1.5 py-0.2 text-[9px] font-bold ${idea.badgeColor}`}>
                    {idea.badge}
                  </span>
                </div>
                <span className={`mt-1 text-xs font-semibold leading-snug line-clamp-1 ${isSelected ? "text-brand" : "text-foreground"}`}>
                  {idea.label}
                </span>
                <span className="text-[10px] text-muted-foreground leading-tight line-clamp-1">
                  {idea.shortDesc}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Textarea Input Box */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Or describe your own day in your own words:</span>
          <span className="text-[10px] opacity-75">Ctrl/Cmd + Enter to submit</span>
        </div>
        <div className="prompt-field neo-inset relative rounded-2xl px-4 py-3 sm:px-5 sm:py-3.5 transition-all duration-200 outline-none focus:outline-none focus-within:outline-none focus-within:ring-0">
          <textarea
            ref={input}
            id="day-prompt"
            value={text}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) {
                e.preventDefault();
                go();
              }
            }}
            rows={3}
            maxLength={1500}
            placeholder={PRESET_IDEAS[activeIdeaIndex].text}
            aria-describedby="day-prompt-help"
            disabled={going}
            className="block min-h-24 sm:min-h-28 w-full resize-none bg-transparent py-1 text-sm sm:text-base leading-relaxed caret-brand outline-none focus:outline-none focus:ring-0 placeholder:text-muted-foreground/75 selection:bg-brand-soft"
          />
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-1 border-t border-border/40">
        <p id="day-prompt-help" className="text-xs text-muted-foreground leading-tight">
          Stops, pace, and transit are auto-optimized.<br className="hidden sm:block" />
          Easily swap or add spots on the live map.
        </p>
        <Button
          type="submit"
          disabled={going || !text.trim()}
          className="neo-primary group h-11 w-full justify-between gap-4 rounded-xl px-5 text-sm font-bold text-on-color focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50 sm:w-auto shadow-md"
        >
          {going ? <CircleNotch weight="bold" className="size-4 animate-spin" aria-hidden /> : null}
          <span>{going ? "Routing your day…" : "Plan my day"}</span>
          {!going && (
            <span className="grid size-7 place-items-center rounded-lg bg-background/20">
              <ArrowRight weight="bold" className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
            </span>
          )}
        </Button>
      </div>

      {/* Secondary Explorer Link */}
      <Link
        href="/plan"
        className="neo-raised neo-control group flex min-h-10 items-center justify-between rounded-xl px-4 text-xs font-semibold text-foreground transition-all hover:text-brand"
      >
        <div className="flex items-center gap-2">
          <MapTrifold weight="duotone" className="size-4 text-brand" aria-hidden />
          <span>Or explore interactive map without a prompt</span>
        </div>
        <ArrowRight weight="bold" className="size-3.5 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-brand" aria-hidden />
      </Link>
    </form>
  );
}
