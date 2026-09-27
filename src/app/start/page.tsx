import { StartPage, startMetadata } from "@/features/plan-with-friends";
import { edFonts } from "@/components/editorial/fonts";
import { requireTraveler } from "@/lib/session";
import "../trip/trip.css";

export const metadata = startMetadata;

export default async function Start() {
  await requireTraveler("/start");
  return (
    <div className={`ed ${edFonts}`}>
      <StartPage />
    </div>
  );
}
