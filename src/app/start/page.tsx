import { StartPage, startMetadata } from "@/features/plan-with-friends";
import { requireTraveler } from "@/lib/session";

export const metadata = startMetadata;

export default async function Start() {
  await requireTraveler("/start");
  return <StartPage />;
}
