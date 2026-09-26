"use client";

import { useState } from "react";
import { Globe, Layers, Moon, Sun, Train, X } from "lucide-react";
import { type MapTheme, useMapTheme } from "./mapStyle";
import { cn } from "@/lib/utils";

export interface MapThemeOption {
  id: MapTheme;
  label: string;
  tagline: string;
  icon: typeof Sun;
  previewBg: string;
}

export const MAP_THEMES: MapThemeOption[] = [
  {
    id: "day",
    label: "Day",
    tagline: "Google Maps-style vibrant streets, green parks & blue rivers",
    icon: Sun,
    previewBg: "linear-gradient(135deg, #a3d9a5 0%, #d4e8c1 40%, #87ceeb 100%)",
  },
  {
    id: "night",
    label: "Night",
    tagline: "Gotham nighttime with glowing avenues, bridges & lights",
    icon: Moon,
    previewBg: "linear-gradient(135deg, #101626 0%, #1a233a 50%, #2a344d 100%)",
  },
  {
    id: "satellite",
    label: "Satellite",
    tagline: "High-resolution photorealistic orbital photography",
    icon: Globe,
    previewBg: "linear-gradient(135deg, #1d3326 0%, #304838 50%, #203c50 100%)",
  },
  {
    id: "transit",
    label: "Transit",
    tagline: "Subway lines, rail corridors, ferry routes & stations",
    icon: Train,
    previewBg: "linear-gradient(135deg, #d88938 0%, #1e5a9c 50%, #902672 100%)",
  },
];

export function MapThemeSwitcher({
  className = "",
  showLayersDialog = false,
}: {
  className?: string;
  showLayersDialog?: boolean;
}) {
  const [currentTheme, setMapTheme] = useMapTheme();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={cn("relative inline-flex items-center", className)}>
      {/* Quick tactile pill buttons */}
      <div
        role="group"
        aria-label="Map style switcher"
        className="neo-inset flex items-center gap-1 rounded-2xl p-1 text-xs backdrop-blur-md transition-all"
      >
        {MAP_THEMES.map((theme) => {
          const active = currentTheme === theme.id;
          const Icon = theme.icon;
          return (
            <button
              key={theme.id}
              type="button"
              aria-pressed={active}
              onClick={() => setMapTheme(theme.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 font-medium transition-all duration-200 select-none",
                active
                  ? "neo-raised font-bold text-brand shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="size-3.5" aria-hidden />
              <span>{theme.label}</span>
            </button>
          );
        })}

        {/* Optional Expandable Map Layers Dialog Trigger Button */}
        {showLayersDialog && (
          <button
            type="button"
            aria-label="Open Map Layers Menu"
            aria-expanded={isOpen}
            onClick={() => setIsOpen((prev) => !prev)}
            className="neo-control ml-0.5 inline-flex size-7 items-center justify-center rounded-xl text-muted-foreground hover:text-brand"
            title="Open Map Layers"
          >
            <Layers className="size-3.5" aria-hidden />
          </button>
        )}
      </div>

      {/* Floating Map Layers Menu (Visual preview cards like Google Maps & OSM) */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-background/20 backdrop-blur-xs"
            onClick={() => setIsOpen(false)}
          />
          <div className="neo-raised absolute top-full left-0 z-50 mt-2 w-72 rounded-3xl p-4 shadow-xl border animate-rise backdrop-blur-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-border/50">
              <div className="flex items-center gap-2">
                <Layers className="size-4 text-brand" aria-hidden />
                <span className="text-sm font-bold tracking-tight">Map Layers</span>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="neo-control grid size-6 place-items-center rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {MAP_THEMES.map((theme) => {
                const active = currentTheme === theme.id;
                const Icon = theme.icon;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => {
                      setMapTheme(theme.id);
                      setIsOpen(false);
                    }}
                    className={cn(
                      "w-full text-left rounded-2xl p-2.5 transition-all flex items-center gap-3 border",
                      active
                        ? "neo-raised border-brand/50 shadow-sm"
                        : "border-transparent hover:bg-muted/40"
                    )}
                  >
                    <div
                      className="size-11 shrink-0 rounded-xl grid place-items-center shadow-xs border border-white/20"
                      style={{ background: theme.previewBg }}
                    >
                      <Icon className="size-5 text-white drop-shadow-md" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className={cn("text-xs font-bold", active && "text-brand")}>
                          {theme.label}
                        </span>
                        {active && (
                          <span className="text-[10px] font-semibold text-brand bg-brand/10 px-1.5 py-0.5 rounded-md">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-tight truncate mt-0.5">
                        {theme.tagline}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
