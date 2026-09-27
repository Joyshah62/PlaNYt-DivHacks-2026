import type { Metadata } from "next";
import { BRAND } from "../bridge/index";
import { AppBar } from "../bridge/ui";
import { StartRoom } from "./StartRoom";
import { TripRoom } from "./TripRoom";
import { WhoIsComing } from "./WhoIsComing";
import type { Viewer } from "./useTripRoom";

/** The signed-in traveler; the app checks sign-in before these pages render. */
export type { Viewer };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;

export const tripStartMetadata: Metadata = { title: `Plan with friends · ${BRAND.name} ${BRAND.suffix}` };
export const startMetadata: Metadata = { title: `Who's coming? · ${BRAND.name} ${BRAND.suffix}` };
export const tripRoomMetadata: Metadata = { title: `Trip room · ${BRAND.name} ${BRAND.suffix}` };

export async function TripStartPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  return <StartRoom code={first(params.plan)?.slice(0, 4000) || null} group={first(params.group)} />;
}

export async function TripRoomPage({ params, viewer = null }: { params: Promise<{ id: string }>; viewer?: Viewer | null }) {
  const { id } = await params;
  return <TripRoom id={id} viewer={viewer} />;
}

export function StartPage() {
  return (
    <main className="ed-app ed-paper tr-page">
      <AppBar />
      <section className="ed-gut tr-start">
        <p className="ed-mono ed-kicker">{BRAND.name} {BRAND.suffix}</p>
        <h1 className="tr-display">Who&apos;s <em>coming?</em></h1>
        <p className="ed-dek">We&apos;ll set up the right kind of plan. Groups get a trip room where everyone decides together.</p>
        <WhoIsComing />
      </section>
    </main>
  );
}
