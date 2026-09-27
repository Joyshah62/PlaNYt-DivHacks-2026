import type { Metadata } from "next";
import { BRAND } from "../bridge/index";
import { StartRoom } from "./StartRoom";
import { TripRoom } from "./TripRoom";
import { WhoIsComing } from "./WhoIsComing";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;

export const tripStartMetadata: Metadata = { title: `Plan with friends · ${BRAND.name} ${BRAND.suffix}` };
export const startMetadata: Metadata = { title: `Who's coming? · ${BRAND.name} ${BRAND.suffix}` };
export const tripRoomMetadata: Metadata = { title: `Trip room · ${BRAND.name} ${BRAND.suffix}` };

export async function TripStartPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  return <StartRoom code={first(params.plan)?.slice(0, 4000) || null} group={first(params.group)} />;
}

export async function TripRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TripRoom id={id} />;
}

export function StartPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-6 px-4 py-10">
      <div className="text-center">
        <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          {BRAND.name} {BRAND.suffix}
        </p>
        <h1 className="mt-2 font-display text-5xl leading-tight">Who&apos;s coming?</h1>
        <p className="mt-2 text-sm text-muted-foreground">We&apos;ll set up the right kind of plan. Groups get a trip room where everyone decides together.</p>
      </div>
      <WhoIsComing />
    </main>
  );
}
