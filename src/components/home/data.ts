import type { Camera, LatLng } from "./camera";

export const HERO: { high: Camera; landed: Camera } = {
  high: { lat: 40.738, lng: -73.99, alt: 0, range: 9000, tilt: 0, heading: -30 },
  landed: { lat: 40.7484, lng: -73.9857, alt: 180, range: 1500, tilt: 64, heading: 30 },
};

export const HERO_LINKS = [
  { label: "The Friends walk", query: "Friends themed day in Greenwich Village: Central Perk coffee vibes, visit Monica's apartment on Bedford St, Washington Square Park fountain, and dinner at a West Village bistro." },
  { label: "Seinfeld's Upper West Side", query: "Classic Seinfeld day on the Upper West Side: Monk's Diner at Tom's Restaurant, walk Central Park West reservoir, Jerry's West 81st St neighborhood, and an evening comedy show." },
  { label: "DUMBO at dusk", query: "Explore DUMBO and Brooklyn Heights: walk across the Brooklyn Bridge, photo spot on Washington St, Jane's Carousel, and waterfront sunset." },
];

export interface DemoStop extends LatLng {
  name: string;
  time: string;
  why: string;
  /** Relative crowd level per hour, 8 bars. */
  crowd: number[];
  /** Index into `crowd` of the hour Roam picked. */
  slot: number;
}

export const DEMO: { sentence: string; overview: Camera; route: Camera; stops: DemoStop[] } = {
  sentence: "Saturday: the Met, Central Park, a skyline view and real NY pizza. We hate crowds.",
  overview: { lat: 40.756, lng: -73.978, alt: 0, range: 7200, tilt: 52, heading: -20 },
  route: { lat: 40.755, lng: -73.983, alt: 0, range: 6200, tilt: 58, heading: -29 },
  stops: [
    { name: "The Met", time: "10:00", lat: 40.7794, lng: -73.9632, why: "72% quieter than 2pm", crowd: [3, 4, 2, 5, 7, 8, 6, 4], slot: 1 },
    { name: "Bethesda Terrace", time: "12:10", lat: 40.774, lng: -73.9712, why: "a 9-minute walk", crowd: [2, 3, 5, 7, 6, 5, 4, 3], slot: 3 },
    { name: "Top of the Rock", time: "2:30", lat: 40.7593, lng: -73.9787, why: "before the sunset rush", crowd: [2, 3, 4, 5, 6, 8, 9, 7], slot: 4 },
    { name: "Joe's Pizza, Carmine St", time: "6:15", lat: 40.7306, lng: -74.0027, why: "dinner where you end up", crowd: [1, 2, 3, 4, 6, 8, 7, 5], slot: 5 },
  ],
};

export interface Neighborhood {
  numeral: string;
  name: string;
  italic: string;
  body: string;
  query: string;
  camera: Camera;
}

export const NEIGHBORHOODS: Neighborhood[] = [
  {
    numeral: "I", name: "Greenwich", italic: "Village",
    body: "Brownstones, basement comedy clubs and the Washington Square arch. Best before noon, when the park still belongs to the chess players.",
    query: "Plan an afternoon in Greenwich Village: visit Washington Square Park, iconic brownstone streets, comedy club, and a rustic Italian dinner.",
    camera: { lat: 40.7309, lng: -73.9973, alt: 30, range: 650, tilt: 62, heading: 200 },
  },
  {
    numeral: "II", name: "Upper", italic: "West Side",
    body: "Pre-war grandeur, the Natural History museum and Jerry's old block. Quietest on weekday mornings.",
    query: "Upper West Side culture tour: American Museum of Natural History, Zabar's bagels, Central Park Strawberry Fields, and Lincoln Center plaza.",
    camera: { lat: 40.7813, lng: -73.974, alt: 40, range: 900, tilt: 60, heading: 120 },
  },
  {
    numeral: "III", name: "DUMBO,", italic: "at dusk",
    body: "Cobblestones under the Manhattan Bridge. Arrive at golden hour and the skyline lights up across the river.",
    query: "Explore DUMBO and Brooklyn Heights: walk across the Brooklyn Bridge, photo spot on Washington St, Jane's Carousel, and waterfront sunset.",
    camera: { lat: 40.7033, lng: -73.9894, alt: 20, range: 700, tilt: 70, heading: 320 },
  },
  {
    numeral: "IV", name: "Midtown,", italic: "after dark",
    body: "Grand Central's whispering gallery, then Top of the Rock after 8pm, once the tour buses have gone.",
    query: "Midtown Manhattan highlights: Grand Central Terminal whispering gallery, Bryant Park library, Top of the Rock, and Broadway theater.",
    camera: { lat: 40.7484, lng: -73.9857, alt: 200, range: 1100, tilt: 68, heading: 35 },
  },
];
