import type { LatLon } from "@/lib/osm/types";

export type AttractionKind = "museum" | "view" | "landmark" | "park" | "food" | "neighborhood";

/** Minutes after midnight. A close past 24:00 means after midnight. */
export type OpenWindow = [open: number, close: number];

/** Index 0 = Sunday. null = closed that day. */
export type WeeklyHours = (OpenWindow | null)[];

export interface Attraction extends LatLon {
  id: string;
  name: string;
  area: string;
  kind: AttractionKind;
  /** A typical visit, in minutes. The reader can change it. */
  visitMin: number;
  /** Typical hours; null = always open (streets, bridges, plazas). */
  hours: WeeklyHours | null;
  blurb: string;
}

const h = (hh: number, mm = 0) => hh * 60 + mm;
const daily = (open: number, close: number): WeeklyHours => Array(7).fill([open, close]);
/** Same hours every day except the given overrides. */
function week(base: OpenWindow | null, overrides: Record<number, OpenWindow | null>): WeeklyHours {
  return Array.from({ length: 7 }, (_, d) => (d in overrides ? overrides[d] : base));
}
const MON = 1, TUE = 2, WED = 3, FRI = 5, SAT = 6;

/**
 * Hand-picked, hand-geocoded. Hours are typical published hours and change for
 * holidays and seasons, which the UI says. Coordinates sit at the entrance or
 * the spot people head for, not the parcel centroid.
 */
export const ATTRACTIONS: Attraction[] = [
  // --- Museums
  { id: "met", name: "The Met", area: "Upper East Side", kind: "museum", visitMin: 150, lat: 40.7794, lon: -73.9632,
    hours: week([h(10), h(17)], { [WED]: null, [FRI]: [h(10), h(21)], [SAT]: [h(10), h(21)] }),
    blurb: "5,000 years of art. Closed Wednesdays." },
  { id: "moma", name: "MoMA", area: "Midtown", kind: "museum", visitMin: 120, lat: 40.7614, lon: -73.9776,
    hours: week([h(10, 30), h(17, 30)], { [SAT]: [h(10, 30), h(19)] }),
    blurb: "Van Gogh, Warhol and the modern canon." },
  { id: "amnh", name: "Natural History Museum", area: "Upper West Side", kind: "museum", visitMin: 150, lat: 40.7813, lon: -73.974,
    hours: daily(h(10), h(17, 30)), blurb: "Dinosaurs, the blue whale, the planetarium." },
  { id: "guggenheim", name: "Guggenheim", area: "Upper East Side", kind: "museum", visitMin: 90, lat: 40.783, lon: -73.959,
    hours: week([h(11), h(18)], { [SAT]: [h(11), h(20)] }), blurb: "Frank Lloyd Wright's spiral." },
  { id: "whitney", name: "Whitney Museum", area: "Meatpacking", kind: "museum", visitMin: 90, lat: 40.7396, lon: -74.0089,
    hours: week([h(10, 30), h(18)], { [TUE]: null, [FRI]: [h(10, 30), h(22)] }), blurb: "American art, terraces over the Hudson." },
  { id: "911-museum", name: "9/11 Memorial & Museum", area: "Financial District", kind: "museum", visitMin: 120, lat: 40.7115, lon: -74.0134,
    hours: daily(h(9), h(19)), blurb: "The memorial pools are free and open late." },
  { id: "tenement", name: "Tenement Museum", area: "Lower East Side", kind: "museum", visitMin: 75, lat: 40.7188, lon: -73.99,
    hours: daily(h(10), h(18)), blurb: "Guided tours of immigrant apartments." },
  { id: "intrepid", name: "Intrepid Museum", area: "Hell's Kitchen", kind: "museum", visitMin: 120, lat: 40.7645, lon: -73.9996,
    hours: daily(h(10), h(17)), blurb: "An aircraft carrier, a Concorde and a space shuttle." },
  { id: "brooklyn-museum", name: "Brooklyn Museum", area: "Prospect Heights", kind: "museum", visitMin: 120, lat: 40.6712, lon: -73.9636,
    hours: week([h(11), h(18)], { [MON]: null, [TUE]: null }), blurb: "Egyptian galleries and The Dinner Party." },
  { id: "cloisters", name: "The Met Cloisters", area: "Fort Tryon Park", kind: "museum", visitMin: 120, lat: 40.8649, lon: -73.9319,
    hours: week([h(10), h(17)], { [WED]: null }), blurb: "Medieval Europe on a hill above the Hudson." },

  // --- Views
  { id: "top-of-the-rock", name: "Top of the Rock", area: "Rockefeller Center", kind: "view", visitMin: 60, lat: 40.7593, lon: -73.9794,
    hours: daily(h(9), h(24)), blurb: "The view with the Empire State in it." },
  { id: "empire-state", name: "Empire State Building", area: "Midtown", kind: "view", visitMin: 75, lat: 40.7484, lon: -73.9857,
    hours: daily(h(10), h(23)), blurb: "86th-floor open-air deck." },
  { id: "summit", name: "SUMMIT One Vanderbilt", area: "Midtown East", kind: "view", visitMin: 75, lat: 40.7527, lon: -73.9787,
    hours: daily(h(9), h(24)), blurb: "Mirrored rooms 1,000 feet up." },
  { id: "edge", name: "Edge", area: "Hudson Yards", kind: "view", visitMin: 60, lat: 40.7537, lon: -74.0012,
    hours: daily(h(9), h(22)), blurb: "Glass-floor sky deck." },
  { id: "one-world", name: "One World Observatory", area: "Financial District", kind: "view", visitMin: 75, lat: 40.713, lon: -74.0132,
    hours: daily(h(9), h(21)), blurb: "The tallest view in the city." },

  // --- Landmarks
  { id: "statue-of-liberty", name: "Statue of Liberty ferry", area: "Battery Park", kind: "landmark", visitMin: 240, lat: 40.7033, lon: -74.017,
    hours: daily(h(8, 30), h(17)), blurb: "Liberty and Ellis Islands. Book the ferry ahead." },
  { id: "staten-island-ferry", name: "Staten Island Ferry", area: "Whitehall Terminal", kind: "landmark", visitMin: 60, lat: 40.7013, lon: -74.0132,
    hours: null, blurb: "Free round trip past the Statue." },
  { id: "brooklyn-bridge", name: "Brooklyn Bridge walk", area: "City Hall → DUMBO", kind: "landmark", visitMin: 45, lat: 40.7118, lon: -74.0035,
    hours: null, blurb: "Starts by City Hall; about 30 minutes across." },
  { id: "times-square", name: "Times Square", area: "Midtown", kind: "landmark", visitMin: 30, lat: 40.758, lon: -73.9855,
    hours: null, blurb: "Best after dark, busiest then too." },
  { id: "grand-central", name: "Grand Central Terminal", area: "Midtown East", kind: "landmark", visitMin: 30, lat: 40.7527, lon: -73.9772,
    hours: daily(h(5, 30), h(26)), blurb: "The ceiling, the whispering gallery." },
  { id: "st-patricks", name: "St. Patrick's Cathedral", area: "Fifth Avenue", kind: "landmark", visitMin: 30, lat: 40.7585, lon: -73.976,
    hours: daily(h(6, 30), h(20, 45)), blurb: "Neo-Gothic, across from Rockefeller Center." },
  { id: "wall-street", name: "Wall Street & Charging Bull", area: "Financial District", kind: "landmark", visitMin: 30, lat: 40.7056, lon: -74.0134,
    hours: null, blurb: "Stock Exchange, Federal Hall, the bull." },
  { id: "roosevelt-tram", name: "Roosevelt Island Tram", area: "59th St & 2nd Ave", kind: "landmark", visitMin: 40, lat: 40.7612, lon: -73.9641,
    hours: daily(h(6), h(26)), blurb: "A subway fare buys the best cheap view." },
  { id: "vessel", name: "Vessel & Hudson Yards", area: "Hudson Yards", kind: "landmark", visitMin: 45, lat: 40.7538, lon: -74.0022,
    hours: daily(h(10), h(21)), blurb: "The honeycomb staircase at the High Line's end." },

  // --- Parks
  { id: "central-park", name: "Central Park", area: "Bethesda Terrace", kind: "park", visitMin: 90, lat: 40.774, lon: -73.971,
    hours: daily(h(6), h(25)), blurb: "Bethesda Fountain, the Mall, Bow Bridge." },
  { id: "high-line", name: "The High Line", area: "Chelsea", kind: "park", visitMin: 60, lat: 40.748, lon: -74.0048,
    hours: daily(h(7), h(22)), blurb: "A rail line turned park, 1.45 miles long." },
  { id: "little-island", name: "Little Island", area: "Pier 55", kind: "park", visitMin: 40, lat: 40.742, lon: -74.0102,
    hours: daily(h(6), h(23)), blurb: "A park on tulip-shaped pilings." },
  { id: "brooklyn-bridge-park", name: "Brooklyn Bridge Park", area: "DUMBO", kind: "park", visitMin: 60, lat: 40.7002, lon: -73.9965,
    hours: daily(h(6), h(25)), blurb: "Piers, lawns and the skyline across the river." },
  { id: "washington-square", name: "Washington Square Park", area: "Greenwich Village", kind: "park", visitMin: 40, lat: 40.7308, lon: -73.9973,
    hours: daily(h(6), h(24)), blurb: "The arch, the fountain, the buskers." },
  { id: "bryant-park", name: "Bryant Park", area: "Midtown", kind: "park", visitMin: 40, lat: 40.7536, lon: -73.9832,
    hours: daily(h(7), h(22)), blurb: "Beside the New York Public Library." },
  { id: "prospect-park", name: "Prospect Park", area: "Park Slope", kind: "park", visitMin: 90, lat: 40.674, lon: -73.97,
    hours: daily(h(5), h(25)), blurb: "Brooklyn's Central Park, calmer." },
  { id: "botanic-garden", name: "Brooklyn Botanic Garden", area: "Prospect Heights", kind: "park", visitMin: 90, lat: 40.6694, lon: -73.9624,
    hours: week([h(10), h(17, 30)], { [MON]: null }), blurb: "Next door to the Brooklyn Museum." },
  { id: "domino-park", name: "Domino Park", area: "Williamsburg", kind: "park", visitMin: 40, lat: 40.7143, lon: -73.968,
    hours: daily(h(6), h(25)), blurb: "Waterfront by the old sugar refinery." },

  // --- Food
  { id: "chelsea-market", name: "Chelsea Market", area: "Chelsea", kind: "food", visitMin: 60, lat: 40.7424, lon: -74.0061,
    hours: daily(h(8), h(21)), blurb: "Food hall under the High Line." },
  { id: "katz", name: "Katz's Delicatessen", area: "Lower East Side", kind: "food", visitMin: 45, lat: 40.7223, lon: -73.9874,
    hours: daily(h(8), h(22)), blurb: "Pastrami on rye since 1888." },
  { id: "chinatown", name: "Chinatown", area: "Mott Street", kind: "food", visitMin: 75, lat: 40.7158, lon: -73.9987,
    hours: daily(h(9), h(22)), blurb: "Dumplings, bakeries, dim sum." },
  { id: "flushing", name: "Flushing food crawl", area: "Main Street, Queens", kind: "food", visitMin: 90, lat: 40.759, lon: -73.83,
    hours: daily(h(9), h(22)), blurb: "The city's best Chinese food, at the end of the 7." },

  // --- Neighborhoods
  { id: "soho", name: "SoHo", area: "Prince & Broadway", kind: "neighborhood", visitMin: 90, lat: 40.7244, lon: -73.9978,
    hours: daily(h(11), h(20)), blurb: "Cast-iron streets and flagship shops." },
  { id: "little-italy", name: "Little Italy", area: "Mulberry Street", kind: "neighborhood", visitMin: 45, lat: 40.719, lon: -73.9973,
    hours: daily(h(10), h(23)), blurb: "Cannoli on Mulberry Street." },
  { id: "dumbo", name: "DUMBO photo spot", area: "Washington Street", kind: "neighborhood", visitMin: 40, lat: 40.7033, lon: -73.9894,
    hours: null, blurb: "The Manhattan Bridge framed by brick." },
  { id: "williamsburg", name: "Williamsburg", area: "Bedford Avenue", kind: "neighborhood", visitMin: 90, lat: 40.7171, lon: -73.957,
    hours: daily(h(10), h(23)), blurb: "Vintage shops, cafés, rooftop bars." },
  { id: "harlem", name: "Harlem & the Apollo", area: "125th Street", kind: "neighborhood", visitMin: 60, lat: 40.81, lon: -73.95,
    hours: daily(h(10), h(22)), blurb: "The Apollo, soul food, brownstone blocks." },
  { id: "coney-island", name: "Coney Island", area: "Boardwalk", kind: "neighborhood", visitMin: 150, lat: 40.5749, lon: -73.9859,
    hours: null, blurb: "Beach, boardwalk, Nathan's. Rides are seasonal." },
  { id: "west-village", name: "West Village", area: "Bleecker Street", kind: "neighborhood", visitMin: 60, lat: 40.7336, lon: -74.0027,
    hours: null, blurb: "Crooked streets, cafés, the Friends building." },
  // --- More places, so the map has something good near most of a day
  { id: "morgan-library", name: "The Morgan Library", area: "Murray Hill", kind: "museum", visitMin: 75, lat: 40.7492, lon: -73.9814,
    hours: week([h(10, 30), h(17)], { [MON]: null, [FRI]: [h(10, 30), h(19)] }), blurb: "J.P. Morgan's library, three storeys of books." },
  { id: "brooklyn-heights-promenade", name: "Brooklyn Heights Promenade", area: "Brooklyn Heights", kind: "view", visitMin: 40, lat: 40.6958, lon: -73.9974,
    hours: null, blurb: "The whole Lower Manhattan skyline across the river." },
  { id: "gantry-plaza", name: "Gantry Plaza State Park", area: "Long Island City", kind: "view", visitMin: 45, lat: 40.7454, lon: -73.9589,
    hours: null, blurb: "The Pepsi-Cola sign and Midtown across the water." },
  { id: "nypl", name: "New York Public Library", area: "Bryant Park", kind: "landmark", visitMin: 45, lat: 40.7532, lon: -73.9822,
    hours: week([h(10), h(18)], { 0: [h(13), h(17)], [TUE]: [h(10), h(20)], [WED]: [h(10), h(20)] }), blurb: "The lions and the Rose Main Reading Room." },
  { id: "flatiron", name: "Flatiron Building", area: "Madison Square", kind: "landmark", visitMin: 20, lat: 40.7411, lon: -73.9897,
    hours: null, blurb: "The wedge where Fifth Avenue meets Broadway." },
  { id: "chrysler", name: "Chrysler Building", area: "Lexington & 42nd", kind: "landmark", visitMin: 20, lat: 40.7516, lon: -73.9755,
    hours: null, blurb: "The art deco spire, best from 42nd Street." },
  { id: "oculus", name: "The Oculus", area: "World Trade Center", kind: "landmark", visitMin: 30, lat: 40.7115, lon: -74.011,
    hours: null, blurb: "Calatrava's white ribs over the trains." },
  { id: "stonewall", name: "Stonewall National Monument", area: "Christopher Street", kind: "landmark", visitMin: 20, lat: 40.7336, lon: -74.0021,
    hours: null, blurb: "Where the fight for LGBTQ+ rights took off." },
  { id: "the-battery", name: "The Battery", area: "Battery Park", kind: "park", visitMin: 40, lat: 40.7033, lon: -74.017,
    hours: null, blurb: "Harbor views and the ferries out to Liberty." },
  { id: "madison-square-park", name: "Madison Square Park", area: "Flatiron", kind: "park", visitMin: 30, lat: 40.742, lon: -73.988,
    hours: null, blurb: "The first Shake Shack, under the Flatiron." },
  { id: "union-square", name: "Union Square", area: "14th Street", kind: "park", visitMin: 30, lat: 40.7359, lon: -73.9911,
    hours: null, blurb: "The Greenmarket on Monday, Wednesday, Friday and Saturday." },
  { id: "joes-pizza", name: "Joe's Pizza", area: "Carmine Street", kind: "food", visitMin: 30, lat: 40.7305, lon: -74.0022,
    hours: daily(h(10), h(28)), blurb: "The classic New York slice since 1975." },
  { id: "russ-daughters", name: "Russ & Daughters", area: "Houston Street", kind: "food", visitMin: 30, lat: 40.7224, lon: -73.9883,
    hours: daily(h(8), h(17)), blurb: "Lox, bagels and herring since 1914." },
  { id: "essex-market", name: "Essex Market", area: "Lower East Side", kind: "food", visitMin: 45, lat: 40.7185, lon: -73.9882,
    hours: week([h(8), h(20)], { 0: [h(10), h(18)] }), blurb: "A century-old market hall full of stalls." },
  { id: "arthur-avenue", name: "Arthur Avenue", area: "Belmont, the Bronx", kind: "food", visitMin: 90, lat: 40.8547, lon: -73.8882,
    hours: week([h(9), h(18)], { 0: null }), blurb: "The Bronx's own Little Italy. Most shops close Sundays." },
  { id: "east-village", name: "East Village", area: "St. Marks Place", kind: "neighborhood", visitMin: 60, lat: 40.7291, lon: -73.987,
    hours: null, blurb: "Dumplings, record shops and late-night slices." },
  { id: "astoria", name: "Astoria", area: "30th Avenue, Queens", kind: "neighborhood", visitMin: 90, lat: 40.7676, lon: -73.9215,
    hours: daily(h(10), h(23)), blurb: "Greek tavernas and beer gardens." },
];

export const ATTRACTION_BY_ID = new Map(ATTRACTIONS.map((a) => [a.id, a]));

export const KIND_LABELS: Record<AttractionKind, string> = {
  museum: "Museums",
  view: "Views",
  landmark: "Landmarks",
  park: "Parks",
  food: "Food",
  neighborhood: "Neighborhoods",
};

export function searchAttractions(text: string, limit = 6): Attraction[] {
  const q = text.trim().toLowerCase();
  if (q.length < 2) return [];
  return ATTRACTIONS.filter((a) => `${a.name} ${a.area}`.toLowerCase().includes(q)).slice(0, limit);
}

/** The open window on a weekday, or null if closed. Undefined hours = always open. */
export function windowOn(hours: WeeklyHours | null | undefined, dow: number): OpenWindow | null | "always" {
  if (!hours) return "always";
  return hours[dow] ?? null;
}
