"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LandingPrompt() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [going, setGoing] = useState(false);

  function go(value: string) {
    const q = value.trim();
    setGoing(true);
    router.push(q ? `/plan?q=${encodeURIComponent(q)}` : "/plan");
  }

  return (
    <form
      suppressHydrationWarning
      onSubmit={(e) => {
        e.preventDefault();
        go(text);
      }}
      className="rounded-3xl border border-border bg-card/95 p-2 shadow-[0_24px_60px_-24px_oklch(0_0_0/0.4)] backdrop-blur-xl transition focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/15"
    >
      <textarea
        suppressHydrationWarning
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            go(text);
          }
        }}
        rows={2}
        maxLength={1500}
        placeholder="Saturday with my parents: the Met, a skyline view and great pizza. We hate crowds."
        aria-label="Describe your day in New York"
        className="w-full resize-none bg-transparent px-4 pt-3 pb-1 text-base leading-relaxed outline-none placeholder:text-muted-foreground sm:text-lg"
      />
      <div className="flex items-center justify-between gap-3 px-2 pb-1">
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Sparkles className="size-3.5 text-brand" aria-hidden /> Describe it in your own words
        </span>
        <Button type="submit" disabled={going} className="h-11 rounded-full bg-brand px-5 text-[15px] font-semibold text-on-color hover:bg-brand/90">
          {going ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          Plan my day
          {!going && <ArrowRight className="size-4" aria-hidden />}
        </Button>
      </div>
    </form>
  );
}
