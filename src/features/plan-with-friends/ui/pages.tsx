import type { Metadata } from "next";
import { BRAND } from "../bridge/index";
import { StartRoom } from "./StartRoom";
import { TripRoom } from "./TripRoom";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;

export const tripStartMetadata: Metadata = { title: `Plan with friends · ${BRAND.name} ${BRAND.suffix}` };
export const tripRoomMetadata: Metadata = { title: `Trip room · ${BRAND.name} ${BRAND.suffix}` };

export async function TripStartPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  return <StartRoom code={first(params.plan)?.slice(0, 4000) || null} group={first(params.group)} />;
}

export async function TripRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TripRoom id={id} />;
}
