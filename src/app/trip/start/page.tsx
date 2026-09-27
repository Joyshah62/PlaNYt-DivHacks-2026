import { TripStartPage, tripStartMetadata } from "@/features/plan-with-friends";
import { requireTraveler } from "@/lib/session";

export const metadata = tripStartMetadata;

export default async function TripStart(props: PageProps<"/trip/start">) {
  const params = await props.searchParams;
  const query = new URLSearchParams(Object.entries(params).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : []))).toString();
  await requireTraveler(`/trip/start${query ? `?${query}` : ""}`);
  return <TripStartPage searchParams={props.searchParams} />;
}
