"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Suggestion } from "@/lib/nyc/geosearch";

export function AddressSearch({
  size = "large",
  initialValue = "",
}: {
  size?: "large" | "compact";
  initialValue?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const [submitting, setSubmitting] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const statusId = useId();

  // Suggestions belong to the text that produced them. Keeping them after the
  // input changes would offer the reader a stale address to select.
  const query = value.trim();
  const matchesQuery = suggestions.length > 0 && query.length >= 3;
  const expanded = open && matchesQuery;

  useEffect(() => {
    if (query.length < 3) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/address-suggest?q=${encodeURIComponent(query)}`,
          { signal: controller.signal },
        );
        const data = (await res.json()) as Suggestion[];
        setSuggestions(data);
        setHighlighted(-1);
      } catch {
        /* aborted or offline - typing still works without suggestions */
      }
    }, 160);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  function submit(address: string) {
    const next = address.trim();
    if (!next) return;
    setSubmitting(true);
    setOpen(false);
    router.push(`/preferences?address=${encodeURIComponent(next)}`);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      setHighlighted(-1);
      return;
    }
    if (!expanded) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => (h + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => (h <= 0 ? suggestions.length - 1 : h - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setHighlighted(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setHighlighted(suggestions.length - 1);
    } else if (e.key === "Enter" && highlighted >= 0) {
      e.preventDefault();
      submit(suggestions[highlighted].label);
    } else if (e.key === "Tab" && highlighted >= 0) {
      setValue(suggestions[highlighted].label);
      setOpen(false);
    }
  }

  const large = size === "large";
  const activeId =
    highlighted >= 0 ? `${listId}-option-${highlighted}` : undefined;

  return (
    <div ref={boxRef} className="relative w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(highlighted >= 0 ? suggestions[highlighted].label : value);
        }}
        className={
          large
            ? "flex items-center gap-2 rounded-full border border-border bg-card/95 p-2 shadow-[0_24px_60px_-24px_oklch(0_0_0/0.4)] backdrop-blur-xl transition focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/15"
            : "flex items-center gap-2"
        }
        role="search"
      >
        <div className="relative flex-1">
          <Search
            aria-hidden
            className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground ${
              large ? "left-4 size-5" : "left-3 size-4"
            }`}
          />
          <input
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setHighlighted(-1);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder="Enter an NYC apartment address"
            aria-label="NYC apartment address"
            role="combobox"
            aria-expanded={expanded}
            aria-controls={expanded ? listId : undefined}
            aria-autocomplete="list"
            aria-activedescendant={activeId}
            aria-describedby={statusId}
            autoComplete="off"
            className={`w-full rounded-full outline-none transition placeholder:text-muted-foreground
              ${large ? "border-0 bg-transparent py-3 pr-2 pl-12 text-base sm:text-lg" : "border border-border bg-card py-2.5 pr-4 pl-9 text-sm shadow-sm focus:border-brand focus:ring-4 focus:ring-brand/10"}`}
          />
        </div>
        <Button
          type="submit"
          disabled={submitting}
          className={`rounded-full bg-brand text-on-color hover:bg-brand/90 ${
            large ? "h-12 shrink-0 px-5 text-[15px] font-semibold sm:px-7" : "h-10 px-5 text-sm"
          }`}
        >
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden /> Checking
            </>
          ) : large ? (
            <>
              <span className="max-sm:hidden">Check apartment</span>
              <ArrowRight className="size-5 sm:hidden" aria-label="Check apartment" />
            </>
          ) : (
            "Check apartment"
          )}
        </Button>
      </form>

      {/* Screen readers are told how many matches arrived; sighted users see the list. */}
      <p id={statusId} role="status" aria-live="polite" className="sr-only">
        {expanded
          ? `${suggestions.length} address ${suggestions.length === 1 ? "suggestion" : "suggestions"} available.`
          : ""}
      </p>

      {expanded && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Address suggestions"
          className="absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border border-border bg-popover shadow-lg"
        >
          {suggestions.map((suggestion, i) => (
            <li
              key={`${suggestion.bbl}-${i}`}
              id={`${listId}-option-${i}`}
              role="option"
              aria-selected={i === highlighted}
              onMouseEnter={() => setHighlighted(i)}
              onMouseDown={(e) => {
                // Fire before the input's blur closes the list.
                e.preventDefault();
                submit(suggestion.label);
              }}
              className={`cursor-pointer px-5 py-3 text-left text-sm transition ${
                i === highlighted ? "bg-accent" : "bg-transparent"
              }`}
            >
              {suggestion.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
