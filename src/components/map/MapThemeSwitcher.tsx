"use client";

import { useEffect, useRef, useState } from "react";
import { Globe, Layers, Moon, Sun, TrainFront, type LucideIcon } from "lucide-react";
import { arrowKeys } from "@/components/plan/arrowKeys";
import { type MapTheme, useMapTheme } from "./mapStyle";

export interface MapThemeOption {
  id: MapTheme;
  label: string;
  tagline: string;
  icon: LucideIcon;
}

export const MAP_THEMES: MapThemeOption[] = [
  { id: "day", label: "Day", tagline: "Quiet streets, the route in ink", icon: Sun },
  { id: "night", label: "Night", tagline: "The city after dark", icon: Moon },
  { id: "satellite", label: "Satellite", tagline: "Aerial photography", icon: Globe },
  { id: "transit", label: "Transit", tagline: "Subway lines and stations", icon: TrainFront },
];

/** One map tool that opens the four map layers (Day, Night, Satellite, Transit). */
export function MapThemeSwitcher() {
  const [currentTheme, setMapTheme] = useMapTheme();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  // Close on a click elsewhere or Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button type="button" aria-label="Map layers" title="Map layers" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((v) => !v)} className="pl-maptool">
        <Layers aria-hidden />
      </button>
      {open && (
        <div role="radiogroup" aria-label="Map layer" className="pl-layers" onKeyDown={(e) => arrowKeys(e, '[role="radio"]', false)}>
          {MAP_THEMES.map((theme) => {
            const Icon = theme.icon;
            return (
              <button
                key={theme.id}
                type="button"
                role="radio"
                aria-checked={currentTheme === theme.id}
                tabIndex={currentTheme === theme.id ? 0 : -1}
                onClick={() => {
                  setMapTheme(theme.id);
                  setOpen(false);
                }}
              >
                <Icon aria-hidden />
                <span className="grid">
                  <span>{theme.label}</span>
                  <span className="pl-muted" style={{ fontSize: "0.85em", fontStyle: "italic" }}>
                    {theme.tagline}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
