import type { Metadata } from "next";
import { TripStart } from "@/components/trip/TripStart";
import { BRAND } from "@/lib/plan/display";

export const metadata: Metadata = { title: `Plan with friends · ${BRAND.name} ${BRAND.suffix}` };

export default async function TripStartPage({ searchParams }: PageProps<"/trip/start">) {
  const { plan } = await searchParams;
  const code = (Array.isArray(plan) ? plan[0] : plan)?.slice(0, 4000) || null;
  return <TripStart code={code} />;
}
