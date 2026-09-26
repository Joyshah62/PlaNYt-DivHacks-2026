import type { Metadata } from "next";
import { BRAND } from "../bridge/index";
import { TripStart } from "./TripStart";
import { TripView } from "./TripView";

export const tripStartMetadata: Metadata = { title: `Plan with friends · ${BRAND.name} ${BRAND.suffix}` };
export const tripRoomMetadata: Metadata = { title: `Group trip · ${BRAND.name} ${BRAND.suffix}` };

export async function TripStartPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { plan } = await searchParams;
  const code = (Array.isArray(plan) ? plan[0] : plan)?.slice(0, 4000) || null;
  return <TripStart code={code} />;
}

export async function TripRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TripView id={id} />;
}
