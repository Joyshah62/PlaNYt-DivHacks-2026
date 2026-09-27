import { TripStartPage, tripStartMetadata } from "@/features/plan-with-friends";
import { edFonts } from "@/components/editorial/fonts";
import { requireTraveler } from "@/lib/session";
import "../trip.css";

export const metadata = tripStartMetadata;

export default async function TripStart(props: PageProps<"/trip/start">) {
  const params = await props.searchParams;
  const query = new URLSearchParams(Object.entries(params).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : []))).toString();
  await requireTraveler(`/trip/start${query ? `?${query}` : ""}`);
  return (
    <div className={`ed ${edFonts}`}>
      <TripStartPage searchParams={props.searchParams} />
    </div>
  );
}
