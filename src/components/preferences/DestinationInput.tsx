"use client";

import { useEffect, useId, useState } from "react";
import { MapPin, X } from "lucide-react";
import { searchKnownDestinations } from "@/lib/osm/places";
import type { Suggestion } from "@/lib/nyc/geosearch";
import type { CustomDestination } from "@/lib/preferences";
import { DESTINATION_ICONS } from "@/components/neighborhood/meta";

const KINDS: { id: CustomDestination["kind"]; label: string }[] = [
  { id: "work", label: "Work" },
  { id: "school", label: "School" },
  { id: "other", label: "Other" },
];

interface Option {
  label: string;
  hint: string | null;
}

/**
 * One frequent destination: what kind of trip it is, and where. Suggestions mix
 * well-known NYC places (instant, local) with real addresses from GeoSearch.
 */
export function DestinationInput({
  value,
  onChange,
  onRemove,
  autoFocus,
}: {
  value: CustomDestination;
  onChange: (next: CustomDestination) => void;
  onRemove: () => void;
  autoFocus?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const [remote, setRemote] = useState<{ query: string; options: Option[] }>({ query: "", options: [] });
  const listId = useId();
  const query = value.text.trim();

  useEffect(() => {
    if (query.length < 3) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/address-suggest?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        const data = (await res.json()) as Suggestion[];
        setRemote({ query, options: data.slice(0, 4).map((s) => ({ label: s.label, hint: null })) });
      } catch {
        /* suggestions are a convenience */
      }
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const known = searchKnownDestinations(query, 4).map((d) => ({ label: d.label, hint: d.hint }));
  const addresses = remote.query === query ? remote.options : [];
  const options = [...known, ...addresses.filter((a) => !known.some((k) => k.label === a.label))].slice(0, 6);
  const expanded = open && options.length > 0 && !options.some((o) => o.label === query);

  function pick(option: Option) {
    onChange({ ...value, text: option.label });
    setOpen(false);
    setHighlighted(-1);
  }

  const Icon = DESTINATION_ICONS[value.kind];

  return (
    <div className="animate-rise rounded-2xl border border-border bg-card p-3 shadow-xs sm:p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex rounded-full bg-muted p-0.5 text-xs" role="radiogroup" aria-label="Kind of trip">
          {KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              role="radio"
              aria-checked={value.kind === k.id}
              onClick={() => onChange({ ...value, kind: k.id })}
              className={`rounded-full px-3 py-1.5 font-medium transition ${
                value.kind === k.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove destination"
          className="grid size-8 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="relative mt-3">
        <Icon aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={value.text}
          autoFocus={autoFocus}
          onChange={(e) => {
            onChange({ ...value, text: e.target.value });
            setOpen(true);
            setHighlighted(-1);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (!expanded) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlighted((h) => (h + 1) % options.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlighted((h) => (h <= 0 ? options.length - 1 : h - 1));
            } else if (e.key === "Enter" && highlighted >= 0) {
              e.preventDefault();
              pick(options[highlighted]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder={value.kind === "school" ? "e.g. Columbia University" : value.kind === "work" ? "Office address or name" : "Gym, family, a friend's place…"}
          aria-label={`${KINDS.find((k) => k.id === value.kind)?.label} destination`}
          role="combobox"
          aria-expanded={expanded}
          aria-controls={expanded ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={highlighted >= 0 ? `${listId}-${highlighted}` : undefined}
          autoComplete="off"
          className="w-full rounded-xl border border-border bg-background py-3 pr-4 pl-10 text-[15px] outline-none transition placeholder:text-muted-foreground focus:border-brand focus:ring-4 focus:ring-brand/10"
        />
        {expanded && (
          <ul id={listId} role="listbox" className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-border bg-popover py-1 shadow-lg">
            {options.map((o, i) => (
              <li
                key={o.label}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === highlighted}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(o);
                }}
                onMouseEnter={() => setHighlighted(i)}
                className={`flex cursor-pointer items-center gap-3 px-3.5 py-2.5 text-sm ${i === highlighted ? "bg-accent" : ""}`}
              >
                <MapPin aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{o.label}</span>
                {o.hint && <span className="ml-auto shrink-0 text-xs text-muted-foreground">{o.hint}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
