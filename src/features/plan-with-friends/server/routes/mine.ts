import { respond } from "../http";
import { resolveMember } from "../member";
import { getTripStore } from "../store";

/** GET /api/trips/mine - the signed-in traveler's trip rooms, newest first. */
export async function GET(request: Request) {
  return respond(async () => {
    const { memberId } = await resolveMember(request, undefined);
    return { trips: memberId ? await getTripStore().mine(memberId) : [] };
  });
}
