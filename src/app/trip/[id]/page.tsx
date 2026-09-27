import { TripRoomPage, tripRoomMetadata } from "@/features/plan-with-friends";
import { memberIdFor } from "@/features/plan-with-friends/server/member";
import { requireTraveler } from "@/lib/session";

export const metadata = tripRoomMetadata;

/** A trip room, for signed-in travelers: invited friends sign in (or sign up) and come straight back. */
export default async function TripPage(props: PageProps<"/trip/[id]">) {
  const { id } = await props.params;
  const session = await requireTraveler(`/trip/${encodeURIComponent(id)}`);
  return <TripRoomPage params={props.params} viewer={{ memberId: memberIdFor(session.user.id), name: session.user.name }} />;
}
