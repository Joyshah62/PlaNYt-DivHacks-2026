import type { Metadata } from "next";
import { TripView } from "@/components/trip/TripView";
import { BRAND } from "@/lib/plan/display";

export const metadata: Metadata = { title: `Group trip · ${BRAND.name} ${BRAND.suffix}` };

export default async function TripPage({ params }: PageProps<"/trip/[id]">) {
  const { id } = await params;
  return <TripView id={id} />;
}
