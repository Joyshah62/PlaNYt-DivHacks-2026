import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  ArrowsClockwise,
  Buildings,
  CompassRose,
  Footprints,
  Sparkle,
  Subway,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import { AmbientMapLazy } from "@/components/map/LazyMaps";
import { LandingPrompt } from "@/components/plan/LandingPrompt";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { BRAND } from "@/lib/plan/display";

const FEATURED_JOURNEYS = [
  {
    id: "friends",
    title: "The 'Friends' Greenwich Village Walk",
    show: "Friends",
    vibe: "Cozy & Nostalgic",
    colorClass: "border-(--friends-purple)/30 text-(--friends-purple)",
    accentBg: "bg-(--friends-purple)/10",
    badgeBg: "bg-(--friends-purple)/15 text-(--friends-purple) border-(--friends-purple)/30",
    desc: "Sip espresso on a velvet couch, photograph Monica's famous apartment facade on Bedford St, and relax by the Washington Square fountain.",
    duration: "4.5 hrs",
    transit: "Walking · 4 stops",
    crowd: "Relaxed pace",
    query: "Friends themed day in Greenwich Village: Central Perk coffee vibes, visit Monica's apartment on Bedford St, Washington Square Park fountain, and dinner at a West Village bistro.",
    stops: [
      { time: "9:30 AM", name: "Village Coffee on Bedford", tag: "Central Perk vibe" },
      { time: "11:15 AM", name: "Monica's Apartment (90 Bedford St)", tag: "Iconic facade" },
      { time: "1:30 PM", name: "Washington Square Fountain", tag: "People watching" },
      { time: "3:45 PM", name: "Lucille Lortel Theatre & Bistro", tag: "West 4th St" },
    ],
  },
  {
    id: "seinfeld",
    title: "The 'Seinfeld' Upper West Side Tour",
    show: "Seinfeld",
    vibe: "Classic NYC Comedy",
    colorClass: "border-(--seinfeld-blue)/30 text-(--seinfeld-blue)",
    accentBg: "bg-(--seinfeld-blue)/10",
    badgeBg: "bg-(--seinfeld-blue)/15 text-(--seinfeld-blue) border-(--seinfeld-blue)/30",
    desc: "Grab a big salad at Monk's Diner (Tom's Restaurant), wander Jerry's UWS stomping grounds, and stroll Central Park West.",
    duration: "5.0 hrs",
    transit: "1 Train & Walking · 4 stops",
    crowd: "Brisk & lively",
    query: "Classic Seinfeld day on the Upper West Side: Monk's Diner at Tom's Restaurant, walk Central Park West reservoir, Jerry's West 81st St neighborhood, and an evening comedy show.",
    stops: [
      { time: "10:00 AM", name: "Monk's Diner (Tom's Restaurant)", tag: "Big Salad & Coffee" },
      { time: "12:15 PM", name: "Central Park West Reservoir", tag: "UWS Promenade" },
      { time: "2:00 PM", name: "Jerry's 81st Street Block", tag: "Brownstones" },
      { time: "4:30 PM", name: "Original Soup Kitchen & Diner", tag: "Midtown West" },
    ],
  },
  {
    id: "himym",
    title: "How I Met Your Mother Midtown Trail",
    show: "HIMYM",
    vibe: "Legendary Manhattan",
    colorClass: "border-brand/40 text-brand",
    accentBg: "bg-brand/10",
    badgeBg: "bg-brand/20 text-brand border-brand/35",
    desc: "Track down the Yellow Umbrella at Central Park South, take in the Empire State view, and toast at MacLaren's booth.",
    duration: "5.5 hrs",
    transit: "Subway N/Q/R · 4 stops",
    crowd: "Golden hour peak",
    query: "How I Met Your Mother route: MacLaren's Pub booth at McGee's, Yellow Umbrella at Central Park South, Empire State Building deck, and Corner Bistro burger.",
    stops: [
      { time: "11:00 AM", name: "MacLaren's Pub (McGee's 55th)", tag: "The corner booth" },
      { time: "1:15 PM", name: "Central Park South Umbrella Spot", tag: "Horse carriages" },
      { time: "3:30 PM", name: "Empire State Building Deck", tag: "360° Sky view" },
      { time: "6:00 PM", name: "Corner Bistro Burger Haven", tag: "Best in NYC" },
    ],
  },
  {
    id: "skyline",
    title: "High Line & Gotham Skyline Horizons",
    show: "NYC Classic",
    vibe: "Architectural & Scenic",
    colorClass: "border-brand/30 text-brand",
    accentBg: "bg-brand/10",
    badgeBg: "bg-brand/15 text-brand border-brand/30",
    desc: "Walk above the streets on the elevated High Line garden, taste through Chelsea Market, and watch dusk fall from Top of the Rock.",
    duration: "6.0 hrs",
    transit: "Subway & Walking · 4 stops",
    crowd: "Scenic views",
    query: "Plan a Saturday with Central Park, the Met, Top of the Rock and Chelsea Market. Subway and walking, 9am to 6pm.",
    stops: [
      { time: "9:00 AM", name: "The High Line Elevated Park", tag: "Hudson views" },
      { time: "11:00 AM", name: "Chelsea Market Artisans", tag: "Tacos & pastries" },
      { time: "2:15 PM", name: "Little Island at Pier 55", tag: "Floating garden" },
      { time: "5:00 PM", name: "Top of the Rock Sunset", tag: "Empire State view" },
    ],
  },
];

const NEIGHBORHOODS = [
  {
    name: "Greenwich Village",
    tagline: "Cafés, comedy cellars & leafy brownstones",
    vibe: "Bohemian Chic",
    stops: "Central Perk · Washington Sq · Comedy Cellar",
    query: "Plan an afternoon in Greenwich Village: visit Washington Square Park, iconic brownstone streets, comedy club, and a rustic Italian dinner.",
  },
  {
    name: "SoHo & Nolita",
    tagline: "Cast-iron architecture, indie boutiques & espresso",
    vibe: "Design & Style",
    stops: "Spring St · Prince St Pizza · Balthazar",
    query: "Day in SoHo and Nolita: boutique shopping on Spring St, Prince St Pizza, cast iron architecture tour, and coffee at a corner café.",
  },
  {
    name: "DUMBO & Brooklyn Bridge",
    tagline: "Cobblestones, waterfront parks & skyline panoramas",
    vibe: "Iconic Waterfront",
    stops: "Jane's Carousel · Washington St · Pier 1",
    query: "Explore DUMBO and Brooklyn Heights: walk across the Brooklyn Bridge, photo spot on Washington St, Jane's Carousel, and waterfront sunset.",
  },
  {
    name: "Upper West Side",
    tagline: "Classic pre-war elegance & Lincoln Center culture",
    vibe: "Historic & Calm",
    stops: "Tom's Diner · Natural History · Zabar's",
    query: "Upper West Side culture tour: American Museum of Natural History, Zabar's bagels, Central Park Strawberry Fields, and Lincoln Center plaza.",
  },
  {
    name: "Chelsea & Meatpacking",
    tagline: "Contemporary art galleries, High Line & Hudson sunsets",
    vibe: "Modern Urban",
    stops: "High Line · Chelsea Market · Whitney Museum",
    query: "Art and dining in Chelsea: Whitney Museum of American Art, High Line walk, Chelsea Market lunch, and Little Island sunset.",
  },
  {
    name: "Midtown & Broadway",
    tagline: "Neon marquees, art deco towers & Grand Central",
    vibe: "Electrifying Heart",
    stops: "Rockefeller Center · Bryant Park · Grand Central",
    query: "Midtown Manhattan highlights: Grand Central Terminal whispering gallery, Bryant Park library, Top of the Rock, and Broadway theater.",
  },
];

const INTELLIGENCE_FEATURES = [
  {
    icon: Subway,
    title: "MTA Subway Live Intelligence",
    desc: "Real-time frequency tracking and delay avoidance. Automatically suggests cross-town walking when the 1 or A train is held.",
  },
  {
    icon: UsersThree,
    title: "Neighborhood Rhythm & Crowd Flow",
    desc: "Predictive crowd curves tell you when Central Park or the Met are calmest, versus when Chelsea Market is buzzing with lunch energy.",
  },
  {
    icon: ArrowsClockwise,
    title: "Adaptive Live Timeline",
    desc: "Linger 20 minutes longer at coffee or duck inside for sudden Hudson showers. Your schedule re-balances with a single tap.",
  },
];

const SITCOM_TAGS = [
  { label: "Central Perk Couch", show: "Friends" },
  { label: "Monica's 90 Bedford St", show: "Friends" },
  { label: "Monk's Diner", show: "Seinfeld" },
  { label: "Jerry's 81st Block", show: "Seinfeld" },
  { label: "MacLaren's Pub", show: "HIMYM" },
  { label: "Yellow Umbrella Corner", show: "HIMYM" },
  { label: "Top of the Rock", show: "Skyline" },
];

export default function Home() {
  return (
    <main className="neo-home relative isolate flex min-h-dvh w-full flex-col overflow-x-clip">
      {/* 3D Satellite backdrop of Manhattan with real OSM buildings & terrain, slowly rotating */}
      <div className="fixed inset-0 -z-20">
        <AmbientMapLazy className="size-full" />
      </div>

      {/* Clean architectural ambient map wash: lets the real satellite photograph shine through cleanly */}
      <div aria-hidden className="neo-map-wash pointer-events-none fixed inset-0 -z-10" />

      {/* Main Header Bar - Full Width with Uniform Padding */}
      <header className="flex w-full items-center justify-between gap-4 px-6 sm:px-10 lg:px-14 xl:px-16 2xl:px-20 py-5">
        <Link
          href="/"
          aria-label={`${BRAND.name} ${BRAND.suffix} home`}
          className="flex items-center gap-3 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
        >
          <span className="neo-raised grid size-11 place-items-center rounded-2xl shadow-sm">
            <CompassRose weight="duotone" className="size-6 text-brand" aria-hidden />
          </span>
          <div>
            <span className="text-xl font-extrabold tracking-tight">
              {BRAND.name}
              <span className="ml-1.5 font-normal text-muted-foreground">{BRAND.suffix}</span>
            </span>
            <p className="hidden text-[10px] font-semibold tracking-wider text-muted-foreground uppercase sm:block">
              New York Urban Explorer
            </p>
          </div>
        </Link>

        {/* Theme and Planner CTA Controls */}
        <div className="flex items-center gap-3">
          <ThemeToggle />

          <Link
            href="/plan"
            className="neo-primary inline-flex min-h-11 items-center gap-2 rounded-xl px-5 py-2 text-sm font-bold shadow-md transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <span>Open Planner</span>
            <ArrowUpRight weight="bold" className="size-4" aria-hidden />
          </Link>
        </div>
      </header>

      {/* Full-Canvas 2-Column Hero Stage - Fills Viewport Height and Width */}
      <section
        aria-labelledby="home-title"
        className="w-full flex-1 flex items-center px-6 sm:px-10 lg:px-14 xl:px-16 2xl:px-20 py-6 lg:py-10"
      >
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 xl:gap-16 items-center">
          {/* Left Column: Rich Brand Information & Real-Time City Context */}
          <div className="lg:col-span-6 flex flex-col items-start text-left space-y-6">
            {/* Striking Bold Headline with Editorial Display Typography */}
            <h1
              id="home-title"
              className="font-display text-[clamp(3.1rem,6.4vw,5.85rem)] leading-[1.02] font-normal tracking-[-0.03em]"
            >
              Your day.<br />
              <span className="italic font-normal bg-gradient-to-r from-teal-700 via-emerald-600 to-cyan-700 dark:from-teal-300 dark:via-emerald-300 dark:to-cyan-200 bg-clip-text text-transparent drop-shadow-xs">
                Your New York.
              </span>
            </h1>

            {/* Expansive Narrative Text */}
            <p className="text-base sm:text-lg leading-relaxed text-foreground/80 max-w-2xl font-normal">
              From Central Perk velvet couches in Greenwich Village to golden hour views from Top of the Rock.
              Roam turns your ideas into effortless New York itineraries with live MTA transit logic and crowd-flow intelligence.
            </p>

            {/* 3 City Intelligence Feature Cards */}
            <div className="grid grid-cols-3 gap-3 w-full pt-1">
              <div className="neo-raised rounded-2xl p-3.5 border">
                <span className="flex items-center gap-1.5 text-xs font-bold text-brand">
                  <Subway weight="duotone" className="size-4" aria-hidden /> Live MTA
                </span>
                <p className="mt-1 text-[11px] text-muted-foreground leading-tight">
                  Real subway frequencies & delay bypasses
                </p>
              </div>

              <div className="neo-raised rounded-2xl p-3.5 border">
                <span className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                  <UsersThree weight="duotone" className="size-4" aria-hidden /> Crowd Flow
                </span>
                <p className="mt-1 text-[11px] text-muted-foreground leading-tight">
                  Avoid long lines with quiet-hour timing
                </p>
              </div>

              <div className="neo-raised rounded-2xl p-3.5 border">
                <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  <ArrowsClockwise weight="duotone" className="size-4" aria-hidden /> Adaptive
                </span>
                <p className="mt-1 text-[11px] text-muted-foreground leading-tight">
                  Instant re-route for rain or extra coffee
                </p>
              </div>
            </div>

            {/* Sitcom & Landmark Quick Badges */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-xs font-bold text-muted-foreground mr-1">Iconic spots:</span>
              {SITCOM_TAGS.map((tag) => (
                <span
                  key={tag.label}
                  className="neo-inset rounded-lg px-2.5 py-1 text-[11px] font-medium text-foreground/80"
                >
                  {tag.label}
                </span>
              ))}
            </div>
          </div>

          {/* Right Column: Expansive Prompt Box with Proper Preset Buttons */}
          <div className="lg:col-span-6 w-full">
            <LandingPrompt />
          </div>
        </div>
      </section>

      {/* Featured Sitcom & Classic Journeys Grid - Full Width Canvas */}
      <section
        aria-label="Featured NYC Sitcom & Iconic Journeys"
        className="w-full px-6 sm:px-10 lg:px-14 xl:px-16 2xl:px-20 py-12"
      >
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-8">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-brand uppercase">
              <Sparkle weight="duotone" className="size-4" aria-hidden />
              <span>Curated Experiences</span>
            </div>
            <h2 className="mt-1 font-display text-2xl font-normal tracking-tight sm:text-3xl lg:text-4xl">
              Walk Through Iconic NYC Moments
            </h2>
            <p className="mt-1 text-sm text-muted-foreground max-w-xl">
              Step into the world of legendary New York sitcoms or classic skyline landmarks, fully mapped with realistic transit times.
            </p>
          </div>

          <Link
            href="/plan"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:underline"
          >
            <span>Custom route planner</span>
            <ArrowRight weight="bold" className="size-3.5" aria-hidden />
          </Link>
        </div>

        {/* 4 Multi-Column Journey Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {FEATURED_JOURNEYS.map((journey) => (
            <article
              key={journey.id}
              className="neo-card flex flex-col justify-between rounded-3xl p-6 sm:p-7 border transition-all duration-300"
            >
              <div>
                {/* Header row */}
                <div className="flex items-start justify-between gap-3">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${journey.badgeBg}`}
                  >
                    <span>{journey.show}</span>
                    <span className="opacity-60">·</span>
                    <span className="font-normal">{journey.vibe}</span>
                  </span>

                  <span className="text-xs font-medium text-muted-foreground tabular-nums">
                    {journey.duration}
                  </span>
                </div>

                <h3 className="mt-3.5 font-display text-xl sm:text-2xl font-bold tracking-tight">{journey.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  {journey.desc}
                </p>

                {/* Stops Timeline */}
                <div className="mt-5 space-y-2.5 rounded-2xl border border-border/50 bg-background/40 p-3.5 backdrop-blur-sm">
                  {journey.stops.map((stop, i) => (
                    <div key={stop.name} className="flex items-center justify-between text-xs gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="neo-inset grid size-6 shrink-0 place-items-center rounded-full text-[10px] font-bold text-brand">
                          {i + 1}
                        </span>
                        <span className="font-medium truncate">{stop.name}</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums">
                        {stop.time}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Card Footer CTA */}
              <div className="mt-6 flex items-center justify-between pt-3 border-t border-border/40">
                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Footprints weight="duotone" className="size-4 text-brand" aria-hidden />
                  <span>{journey.transit}</span>
                </span>

                <Link
                  href={{ pathname: "/plan", query: { q: journey.query } }}
                  className="group inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-brand transition-all hover:bg-brand/10"
                >
                  <span>Explore this Day</span>
                  <ArrowRight weight="bold" className="size-3.5 transition-transform duration-200 group-hover:translate-x-1" aria-hidden />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Neighborhood Spotlight Carousel / Grid - Full Width Canvas */}
      <section
        aria-label="New York Neighborhood Explorer"
        className="w-full px-6 sm:px-10 lg:px-14 xl:px-16 2xl:px-20 py-12"
      >
        <div className="mb-6">
          <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-brand uppercase">
            <Buildings weight="duotone" className="size-4" aria-hidden />
            <span>Boroughs & Neighborhoods</span>
          </div>
          <h2 className="mt-1 font-display text-2xl font-normal tracking-tight sm:text-3xl lg:text-4xl">
            Choose Your Corner of the City
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Each enclave has its own personality, café culture, and transit connections.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {NEIGHBORHOODS.map((hood) => (
            <Link
              key={hood.name}
              href={{ pathname: "/plan", query: { q: hood.query } }}
              className="neo-raised group flex flex-col justify-between rounded-2xl p-5 transition-all duration-200 hover:-translate-y-1"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-brand">{hood.vibe}</span>
                  <ArrowUpRight weight="bold" className="size-4 text-muted-foreground transition-transform duration-200 group-hover:text-brand group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
                </div>
                <h3 className="mt-2 font-display text-lg font-bold tracking-tight">{hood.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  {hood.tagline}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-border/40 text-[11px] text-muted-foreground truncate">
                <span className="font-semibold text-foreground/80">Highlights: </span>
                <span>{hood.stops}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Urban Intelligence Features Section - Full Width Canvas */}
      <section
        aria-labelledby="features-title"
        className="w-full px-6 sm:px-10 lg:px-14 xl:px-16 2xl:px-20 py-12"
      >
        <div className="neo-raised rounded-3xl p-6 sm:p-10 border">
          <div className="max-w-2xl">
            <h2 id="features-title" className="font-display text-2xl font-normal tracking-tight sm:text-3xl lg:text-4xl">
              Engineered for the Real NYC
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Most map apps pretend trains always run on time and museums never have lines.
              {BRAND.name} is powered by live MTA schedules, walking times, and density trends.
            </p>
          </div>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            {INTELLIGENCE_FEATURES.map((feat) => {
              const Icon = feat.icon;
              return (
                <div key={feat.title} className="flex flex-col gap-3">
                  <span className="neo-inset grid size-10 place-items-center rounded-xl text-brand">
                    <Icon weight="duotone" className="size-5" aria-hidden />
                  </span>
                  <h3 className="text-base font-semibold">{feat.title}</h3>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {feat.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Modern Footer - Full Width Canvas */}
      <footer id="how" className="w-full px-6 sm:px-10 lg:px-14 xl:px-16 2xl:px-20 pb-8 pt-4">
        <div className="neo-raised rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 border">
          <div>
            <div className="flex items-center gap-2">
              <span className="neo-inset grid size-8 place-items-center rounded-xl">
                <CompassRose weight="duotone" className="size-5 text-brand" aria-hidden />
              </span>
              <span className="font-bold tracking-tight">
                {BRAND.name} <span className="font-normal text-muted-foreground">{BRAND.suffix}</span>
              </span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground max-w-md">
              Adaptive New York itineraries tailored for sitcom fans, culture explorers, and weekend wanderers.
              Live MTA GTFS alerts & 3D OpenStreetMap tiles.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-muted-foreground">
            <Link href="/plan" className="hover:text-brand transition-colors">Planner</Link>
            <a href="#home-title" className="hover:text-brand transition-colors">Back to top</a>
            <span className="text-[11px] opacity-60">© {new Date().getFullYear()} {BRAND.name}</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
