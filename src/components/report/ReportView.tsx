"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { AlertCircle, Building2, CircleAlert, LayoutGrid, Loader2, MapPin, Route } from "lucide-react";
import { AddressSearch } from "@/components/AddressSearch";
import { SiteHeader } from "@/components/SiteHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { NO_HIGHLIGHT, type MapDestination, type MapFrame, type MapHighlight, type MapPick } from "@/components/map/mapTypes";
import { CategoryChips, DestinationCard, MapControls, PlaceCard, ZoneLegend, type LayerState } from "@/components/map/MapChrome";
import type { BuildingReport } from "@/lib/nyc/types";
import { CATEGORIES } from "@/lib/osm/categories";
import type { CategoryId, CommuteReport, LatLon, NearbyReport, RouteResult } from "@/lib/osm/types";
import { encodePreferences, lifestyleHighlights, type LifestyleHighlight, type PreferenceId, type Preferences } from "@/lib/preferences";
import { useJson, type Fetched } from "@/lib/useJson";
import { cn } from "@/lib/utils";
import { BuildingHealthSection } from "./BuildingHealthSection";
import { CommuteTab } from "./CommuteTab";
import { NearbyTab, type Band } from "./NearbyTab";
import { OverviewTab, type GlanceTarget } from "./OverviewTab";
import { PanelHeader, type InputState } from "./PanelHeader";

// WebGL and window access: client only.
const CityMap = dynamic(() => import("@/components/map/CityMap").then((m) => m.CityMap), {
  ssr: false,
  loading: () => <Skeleton className="size-full rounded-none" />,
});

interface Located {
  label: string;
  borough: string;
  zip: string | null;
  bin: string;
  location: LatLon | null;
}

type Tab = "overview" | "nearby" | "commute" | "building";
const TABS: { id: Tab; label: string; icon: typeof LayoutGrid }[] = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "nearby", label: "Nearby", icon: MapPin },
  { id: "commute", label: "Commute", icon: Route },
  { id: "building", label: "Building", icon: Building2 },
];

const CHIP_CATEGORIES = CATEGORIES.filter((c) => c.id !== "bus").map((c) => c.id);

function inputState(f: Fetched<unknown>, ok = true): InputState {
  if (f.status === "error" || (f.status === "ok" && !ok)) return "failed";
  return f.status === "ok" ? "ready" : "loading";
}

function subscribeDesktop(cb: () => void) {
  const mq = window.matchMedia("(min-width: 1024px)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
function useDesktop() {
  return useSyncExternalStore(subscribeDesktop, () => window.matchMedia("(min-width: 1024px)").matches, () => true);
}

/**
 * The report is a map with a story beside it. Five independent requests feed
 * it (address, building, places, trips, walking zones); each part renders the
 * moment its own data lands, and the tab you are on decides what the map shows.
 */
export function ReportView({ address, preferences }: { address: string; preferences: Preferences }) {
  const q = encodeURIComponent(address);
  const locate = useJson<Located>(`/api/locate?address=${q}`);
  const center = locate.data?.location ?? null;
  const at = center ? `lat=${center.lat}&lon=${center.lon}` : null;
  const toParam = encodePreferences(preferences).get("to");

  const building = useJson<BuildingReport>(`/api/building-report?address=${q}`);
  const nearby = useJson<NearbyReport>(at && `/api/nearby?${at}`);
  const commute = useJson<CommuteReport>(at && `/api/commute?${at}${toParam ? `&to=${encodeURIComponent(toParam)}` : ""}`);
  const zones = useJson<GeoJSON.FeatureCollection>(at && `/api/isochrone?${at}`);

  const [tab, setTab] = useState<Tab>("overview");
  const [category, setCategoryState] = useState<CategoryId | null>(null);
  const [cuisine, setCuisine] = useState<string | null>(null);
  const [focusedPref, setFocusedPref] = useState<PreferenceId | null>(null);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [selectedDestId, setSelectedDestId] = useState<string | null>(null);
  const [destMode, setDestMode] = useState<"foot" | "car">("car");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [band, setBand] = useState<Band>(10);
  const [layers, setLayers] = useState<LayerState>({ zones: true, buildings3d: false, heatmap: false });
  const [recenter, setRecenter] = useState(0);
  const mapBoxRef = useRef<HTMLDivElement>(null);
  const desktop = useDesktop();

  const editParams = encodePreferences(preferences);
  editParams.set("address", address);
  const editHref = `/preferences?${editParams}`;

  const places = useMemo(() => nearby.data?.places ?? [], [nearby.data]);
  const highlights = useMemo(() => lifestyleHighlights(preferences.prefs, nearby.data, commute.data), [preferences.prefs, nearby.data, commute.data]);
  const focusedHighlight = focusedPref ? highlights.find((h) => h.pref === focusedPref) ?? null : null;
  const selectedPlace = selectedPlaceId ? places.find((p) => p.id === selectedPlaceId) ?? null : null;
  const selectedDest = selectedDestId ? commute.data?.rows.find((r) => r.id === selectedDestId) ?? null : null;

  // --- selection ------------------------------------------------------------

  const clearSelection = useCallback(() => {
    setSelectedPlaceId(null);
    setSelectedDestId(null);
  }, []);

  function revealMap() {
    if (!desktop) mapBoxRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function selectPlace(id: string) {
    setSelectedDestId(null);
    setSelectedPlaceId(id);
    revealMap();
  }

  function selectDestination(id: string) {
    const row = commute.data?.rows.find((r) => r.id === id);
    setSelectedPlaceId(null);
    setSelectedDestId(id);
    setDestMode(row?.walkMin !== null && row?.walkMin !== undefined && row.walkMin <= 20 ? "foot" : "car");
    revealMap();
  }

  function setCategory(id: CategoryId | null, nextCuisine: string | null = null) {
    setFocusedPref(null);
    setSelectedPlaceId(null);
    setCategoryState(id);
    setCuisine(id ? nextCuisine : null);
  }

  function focusHighlight(h: LifestyleHighlight | null) {
    clearSelection();
    setCategoryState(null);
    setCuisine(null);
    setFocusedPref(h?.pref ?? null);
    if (h) revealMap();
  }

  function changeTab(next: Tab) {
    setTab(next);
    // Each tab owns what the map calls out; a filter from another tab would mislead.
    if (next !== "nearby") {
      setCategoryState(null);
      setCuisine(null);
    }
    if (next !== "overview") setFocusedPref(null);
    if (next !== "commute") setSelectedDestId(null);
    if (next === "building") clearSelection();
  }

  function go(target: GlanceTarget) {
    if (target.kind === "place") selectPlace(target.id);
    else if (target.kind === "category") {
      changeTab("nearby");
      setCategory(target.id);
      revealMap();
    } else if (target.kind === "building") changeTab("building");
    else {
      changeTab("commute");
      selectDestination(target.id);
    }
  }

  function onPick(pick: MapPick) {
    if (!pick) return clearSelection();
    if (pick.kind === "destination") {
      if (tab !== "commute") setTab("commute");
      selectDestination(pick.id);
    } else {
      if (tab === "building") setTab("nearby");
      selectPlace(pick.id);
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") clearSelection();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clearSelection]);

  // --- what the map shows ---------------------------------------------------

  const highlight: MapHighlight = useMemo(() => {
    if (focusedHighlight) return { categories: null, cuisine: null, ids: focusedHighlight.placeIds };
    if (category) return { categories: [category], cuisine, ids: null };
    if (tab === "commute") return { categories: ["subway", "bus"], cuisine: null, ids: null };
    return NO_HIGHLIGHT;
  }, [focusedHighlight, category, cuisine, tab]);

  const routeUrl = center
    ? selectedPlace
      ? `/api/route?from=${center.lat},${center.lon}&to=${selectedPlace.lat},${selectedPlace.lon}&mode=foot`
      : selectedDest
        ? `/api/route?from=${center.lat},${center.lon}&to=${selectedDest.lat},${selectedDest.lon}&mode=${destMode}`
        : null
    : null;
  const route = useJson<RouteResult>(routeUrl);
  const routeMode: "foot" | "car" = selectedPlace ? "foot" : destMode;
  const mapRoute = useMemo(() => (route.data ? { coordinates: route.data.coordinates, mode: routeMode } : null), [route.data, routeMode]);

  const destinations: MapDestination[] = useMemo(
    () =>
      tab === "commute" && commute.data
        ? commute.data.rows.map((r) => ({ id: r.id, label: r.label, lat: r.lat, lon: r.lon, custom: r.kind !== "preset" }))
        : [],
    [tab, commute.data],
  );

  const frame: MapFrame = useMemo(() => {
    const tag = `#${recenter}`;
    if (!center) return { key: "none", points: [] };
    const home: [number, number] = [center.lon, center.lat];
    if (mapRoute && (selectedPlace || selectedDest)) {
      return { key: `route:${selectedPlaceId ?? selectedDestId}:${routeMode}${tag}`, points: mapRoute.coordinates };
    }
    if (selectedPlace) return { key: `place:${selectedPlace.id}${tag}`, points: [home, [selectedPlace.lon, selectedPlace.lat]], maxZoom: 16.5 };
    if (selectedDest) return { key: `dest:${selectedDest.id}${tag}`, points: [home, [selectedDest.lon, selectedDest.lat]] };
    if (tab === "commute" && destinations.length) return { key: `commute${tag}`, points: [home, ...destinations.map((d) => [d.lon, d.lat] as [number, number])] };
    if (highlight.ids || highlight.categories) {
      const hits = places.filter((p) =>
        highlight.ids ? highlight.ids.includes(p.id) : highlight.categories!.includes(p.category) && (!highlight.cuisine || p.cuisine === highlight.cuisine),
      );
      const near = hits.filter((p) => p.walkMin <= 15);
      const pts = (near.length ? near : hits.slice(0, 3)).map((p) => [p.lon, p.lat] as [number, number]);
      return { key: `hl:${highlight.ids?.join(",") ?? highlight.categories!.join(",")}:${highlight.cuisine}:${places.length}${tag}`, points: [home, ...pts] };
    }
    // Home: frame the 10-minute walk.
    const d = 0.0072;
    const dl = d / Math.cos((center.lat * Math.PI) / 180);
    return { key: `home${tag}`, points: [[center.lon - dl, center.lat - d], [center.lon + dl, center.lat + d]] };
  }, [center, mapRoute, selectedPlace, selectedDest, selectedPlaceId, selectedDestId, routeMode, tab, destinations, highlight, places, recenter]);

  const cardOpen = !!(selectedPlace || selectedDest);
  const padding = desktop
    ? { top: tab === "building" ? 40 : 72, right: 72, bottom: 48, left: cardOpen ? 440 : 48 }
    : { top: 60, right: 60, bottom: 32, left: 28 };

  const chipOptions = useMemo(
    () =>
      nearby.data?.placesStatus.ok
        ? CHIP_CATEGORIES.map((id) => ({ id, count: nearby.data!.categories.find((c) => c.id === id)?.within15 ?? 0 })).filter((c) => c.count > 0)
        : [],
    [nearby.data],
  );

  // --- render ----------------------------------------------------------------

  if (locate.status === "error") {
    return (
      <>
        <SiteHeader search={false} />
        <main className="mx-auto w-full max-w-md px-4 py-28">
          <AlertCircle className="size-7 text-muted-foreground" aria-hidden />
          <h1 className="mt-5 font-display text-4xl leading-tight text-pretty">{locate.error.error}</h1>
          {locate.error.hint && <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{locate.error.hint}</p>}
          <div className="mt-8">
            <AddressSearch size="compact" initialValue={address} />
          </div>
          <p className="mt-6 text-sm">
            <Link href="/" className="text-brand underline underline-offset-4">
              Start a new search
            </Link>
          </p>
        </main>
      </>
    );
  }

  const place = locate.data
    ? { address: building.data?.building.address ?? locate.data.label, borough: locate.data.borough, zip: building.data?.building.zip ?? locate.data.zip }
    : null;
  const placesFailed = nearby.status === "error" || (nearby.data !== null && !nearby.data.placesStatus.ok);
  const wide = tab === "building";
  const zonesExact = zones.status === "ok";

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh">
      <SiteHeader wide />

      <div
        className="flex flex-1 flex-col lg:grid lg:min-h-0 lg:transition-[grid-template-columns] lg:duration-500 lg:ease-[cubic-bezier(0.2,0.8,0.2,1)]"
        style={desktop ? { gridTemplateColumns: wide ? "minmax(0, min(1100px, 66vw)) minmax(0, 1fr)" : "minmax(0, 540px) minmax(0, 1fr)" } : undefined}
      >
        {/* Map */}
        <div className="order-1 lg:order-2 lg:relative lg:min-h-0">
          <div ref={mapBoxRef} className="relative h-[48vh] min-h-[320px] scroll-mt-16 lg:h-full">
            {center ? (
              <div className="absolute inset-0">
              <CityMap
                center={center}
                places={places}
                highlight={highlight}
                selectedId={selectedPlaceId}
                hoveredId={hoveredId}
                zones={zones.data ?? null}
                showZones={layers.zones}
                buildings3d={layers.buildings3d}
                heatmap={layers.heatmap}
                route={mapRoute}
                destinations={destinations}
                selectedDestinationId={selectedDestId}
                frame={frame}
                padding={padding}
                onPick={onPick}
                className="size-full"
              />
              </div>
            ) : (
              <Skeleton className="absolute inset-0 rounded-none" />
            )}

            {/* Floating chrome */}
            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start gap-3 p-3">
              <div className="min-w-0 flex-1">
                {tab !== "building" && chipOptions.length > 0 && (
                  <CategoryChips
                    options={chipOptions}
                    active={category}
                    onChange={(id) => {
                      if (id && tab !== "nearby") changeTab("nearby");
                      setCategory(id);
                    }}
                  />
                )}
                {nearby.status === "loading" && (
                  <span className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-card/90 px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur">
                    <Loader2 className="size-3.5 animate-spin text-brand" aria-hidden /> Mapping the neighborhood…
                  </span>
                )}
                {placesFailed && (
                  <span className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-card/90 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur">
                    <CircleAlert className="size-3.5" aria-hidden /> Places unavailable right now
                  </span>
                )}
              </div>
              {center && (
                <MapControls
                  layers={layers}
                  onLayers={setLayers}
                  zonesExact={zonesExact}
                  onRecenter={() => {
                    clearSelection();
                    setRecenter((n) => n + 1);
                  }}
                />
              )}
            </div>

            {desktop && (
              <div className="pointer-events-none absolute bottom-4 left-4 z-10 flex max-w-sm flex-col items-start gap-2">
                {!cardOpen && layers.zones && center && <ZoneLegend exact={zonesExact} />}
                {selectedPlace && <PlaceCard place={selectedPlace} route={route.data} routeLoading={route.status === "loading"} onClose={clearSelection} />}
                {selectedDest && center && (
                  <DestinationCard row={selectedDest} mode={destMode} onMode={setDestMode} route={route.data} routeLoading={route.status === "loading"} routeFailed={route.status === "error"} origin={center} onClose={clearSelection} />
                )}
              </div>
            )}
          </div>

          {!desktop && cardOpen && center && (
            <div className="border-b border-border bg-background p-3">
              {selectedPlace && <PlaceCard place={selectedPlace} route={route.data} routeLoading={route.status === "loading"} onClose={clearSelection} />}
              {selectedDest && (
                <DestinationCard row={selectedDest} mode={destMode} onMode={setDestMode} route={route.data} routeLoading={route.status === "loading"} routeFailed={route.status === "error"} origin={center} onClose={clearSelection} />
              )}
            </div>
          )}
        </div>

        {/* Panel */}
        <aside className="order-2 flex flex-col border-border bg-background lg:order-1 lg:min-h-0 lg:overflow-y-auto lg:border-r" aria-label="Report">
          <PanelHeader
            place={place}
            building={building.data?.building ?? null}
            buildingLoading={building.status === "loading"}
            prefs={preferences.prefs}
            editHref={editHref}
            inputs={[
              { label: "Building", state: inputState(building) },
              { label: "Places", state: inputState(nearby, !placesFailed) },
              { label: "Trips", state: inputState(commute) },
            ]}
          />

          <div className="sticky top-16 z-20 border-y border-border bg-background/90 px-5 py-2.5 backdrop-blur-xl sm:px-8 lg:top-0 print:hidden">
            <div role="tablist" aria-label="Report sections" className="grid grid-cols-4 gap-1 rounded-full bg-muted p-1">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  id={`tab-${id}`}
                  aria-selected={tab === id}
                  aria-controls={`panel-${id}`}
                  onClick={() => changeTab(id)}
                  className={cn(
                    "inline-flex items-center justify-center gap-1.5 rounded-full py-2 text-[13px] font-medium transition",
                    tab === id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="size-3.5 max-sm:hidden" aria-hidden />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div key={tab} role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="animate-rise flex-1 px-5 py-7 sm:px-8">
            {tab === "overview" && (
              <OverviewTab
                nearby={nearby}
                commute={commute}
                building={building}
                prefs={preferences.prefs}
                highlights={highlights}
                highlightLoading={(id) => (id === "commute" ? commute.status === "loading" || commute.status === "idle" : nearby.status === "loading" || nearby.status === "idle")}
                focusedPref={focusedPref}
                onFocusHighlight={focusHighlight}
                onGo={go}
                editHref={editHref}
              />
            )}
            {tab === "nearby" && (
              <NearbyTab
                nearby={nearby}
                onRetry={nearby.retry}
                band={band}
                onBand={setBand}
                category={category}
                cuisine={cuisine}
                onCategory={setCategory}
                selectedId={selectedPlaceId}
                onSelect={selectPlace}
                onHover={setHoveredId}
              />
            )}
            {tab === "commute" && (
              <CommuteTab commute={commute} nearby={nearby} onRetry={commute.retry} selectedId={selectedDestId} onSelect={selectDestination} onSelectStation={selectPlace} />
            )}
            {tab === "building" && <BuildingHealthSection building={building} onRetry={building.retry} />}
          </div>

          <footer className="border-t border-border px-5 py-6 text-[11px] leading-relaxed text-muted-foreground sm:px-8 print:hidden">
            Building records: NYC HPD, PLUTO (NYC Open Data). Addresses: NYC Planning GeoSearch. Places © OpenStreetMap contributors via Overpass. Routes: OSRM.
            Walking zones: Valhalla. Map: OpenFreeMap, OpenMapTiles. Times are estimates, not live traffic or transit.
          </footer>
        </aside>
      </div>
    </div>
  );
}
