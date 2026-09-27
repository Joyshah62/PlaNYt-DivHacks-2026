import type { Camera, LatLng } from "./camera";

/** Seconds per full turn for every map that orbits a landmark (about 1° a second). */
export const ORBIT_SECONDS = 360;

export const HERO: { high: Camera; landed: Camera } = {
  high: { lat: 40.738, lng: -73.99, alt: 0, range: 9000, tilt: 0, heading: -30 },
  landed: { lat: 40.7484, lng: -73.9857, alt: 180, range: 1500, tilt: 64, heading: 30 },
};

/** The hero's shortcuts: three show at a time and flip through the rest (PresetFlip). */
export const PRESETS = [
  { label: "The Friends walk", query: "Friends themed day in Greenwich Village: Central Perk coffee vibes, visit Monica's apartment on Bedford St, Washington Square Park fountain, and dinner at a West Village bistro." },
  { label: "Seinfeld's Upper West Side", query: "Classic Seinfeld day on the Upper West Side: Monk's Diner at Tom's Restaurant, walk Central Park West reservoir, Jerry's West 81st St neighborhood, and an evening comedy show." },
  { label: "DUMBO at dusk", query: "Explore DUMBO and Brooklyn Heights: walk across the Brooklyn Bridge, photo spot on Washington St, Jane's Carousel, and waterfront sunset." },
  { label: "The HIMYM Midtown trail", query: "How I Met Your Mother route: MacLaren's Pub booth at McGee's, Yellow Umbrella at Central Park South, Empire State Building deck, and Corner Bistro burger." },
  { label: "High Line & skyline", query: "Plan a Saturday with Central Park, the Met, Top of the Rock and Chelsea Market. Subway and walking, 9am to 6pm." },
  { label: "Museum Mile morning", query: "A quiet morning on Museum Mile: the Met, the Guggenheim and the Neue Galerie, with coffee on Madison Avenue." },
  { label: "Harlem soul & jazz", query: "An evening in Harlem: the Apollo Theater, soul food on Lenox Avenue and a late jazz set." },
  { label: "Lower East Side food crawl", query: "A Lower East Side food crawl: Katz's Delicatessen, Russ & Daughters, dumplings in Chinatown and the Tenement Museum." },
  { label: "Central Park, slowly", query: "A slow day in Central Park: Bethesda Terrace, the Bow Bridge, Strawberry Fields and a rowboat on the lake." },
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

export interface DemoPlan {
  sentence: string;
  /** Where the camera waits while the sentence types. */
  overview: Camera;
  /** The camera for the drawn route. */
  route: Camera;
  stops: DemoStop[];
  /** The callout once the route is drawn. */
  saving: string;
}

/** "Watch it plan" cycles through these: each replay shows the next one. */
export const DEMOS: DemoPlan[] = [
  {
    sentence: "Saturday: the Met, Central Park, a skyline view and real NY pizza. We hate crowds.",
    overview: { lat: 40.756, lng: -73.978, alt: 0, range: 7200, tilt: 52, heading: -20 },
    route: { lat: 40.755, lng: -73.983, alt: 0, range: 6200, tilt: 58, heading: -29 },
    saving: "44 min less travel",
    stops: [
      { name: "The Met", time: "10:00", lat: 40.7794, lng: -73.9632, why: "72% quieter than 2pm", crowd: [3, 4, 2, 5, 7, 8, 6, 4], slot: 1 },
      { name: "Bethesda Terrace", time: "12:10", lat: 40.774, lng: -73.9712, why: "a 9-minute walk", crowd: [2, 3, 5, 7, 6, 5, 4, 3], slot: 3 },
      { name: "Top of the Rock", time: "2:30", lat: 40.7593, lng: -73.9787, why: "before the sunset rush", crowd: [2, 3, 4, 5, 6, 8, 9, 7], slot: 4 },
      { name: "Joe's Pizza, Carmine St", time: "6:15", lat: 40.7306, lng: -74.0027, why: "dinner where you end up", crowd: [1, 2, 3, 4, 6, 8, 7, 5], slot: 5 },
    ],
  },
  {
    sentence: "Sunday in Brooklyn: walk the bridge, DUMBO photos, the Promenade and great pizza.",
    overview: { lat: 40.703, lng: -73.992, alt: 0, range: 3600, tilt: 50, heading: -10 },
    route: { lat: 40.7015, lng: -73.9935, alt: 0, range: 2800, tilt: 58, heading: 20 },
    saving: "31 min less travel",
    stops: [
      { name: "Brooklyn Bridge", time: "9:30", lat: 40.7061, lng: -73.9969, why: "before the tour groups", crowd: [2, 2, 5, 8, 9, 8, 6, 4], slot: 1 },
      { name: "Washington St, DUMBO", time: "10:45", lat: 40.7033, lng: -73.9894, why: "the photo without the queue", crowd: [1, 2, 4, 7, 9, 9, 7, 5], slot: 1 },
      { name: "Brooklyn Heights Promenade", time: "1:30", lat: 40.6958, lng: -73.9974, why: "a 14-minute walk", crowd: [2, 3, 4, 5, 4, 6, 7, 5], slot: 4 },
      { name: "Juliana's Pizza", time: "5:45", lat: 40.7026, lng: -73.9934, why: "dinner as the skyline lights up", crowd: [2, 3, 4, 6, 4, 8, 9, 7], slot: 4 },
    ],
  },
  {
    sentence: "Friday downtown: the 9/11 Memorial, Chelsea Market, the High Line and Washington Square.",
    overview: { lat: 40.731, lng: -74.004, alt: 0, range: 6800, tilt: 50, heading: -25 },
    route: { lat: 40.73, lng: -74.006, alt: 0, range: 5600, tilt: 58, heading: -30 },
    saving: "38 min less travel",
    stops: [
      { name: "9/11 Memorial", time: "9:00", lat: 40.7115, lng: -74.0134, why: "before the lines build", crowd: [3, 2, 5, 7, 8, 8, 7, 5], slot: 1 },
      { name: "Chelsea Market", time: "11:30", lat: 40.7424, lng: -74.006, why: "lunch before the rush", crowd: [1, 2, 3, 4, 8, 9, 7, 5], slot: 3 },
      { name: "The High Line", time: "1:15", lat: 40.747, lng: -74.0051, why: "a 5-minute stroll north", crowd: [1, 2, 4, 6, 5, 7, 8, 6], slot: 4 },
      { name: "Washington Square Park", time: "4:30", lat: 40.7308, lng: -73.9973, why: "the fountain at golden hour", crowd: [2, 3, 4, 5, 6, 5, 7, 8], slot: 5 },
    ],
  },
];

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
