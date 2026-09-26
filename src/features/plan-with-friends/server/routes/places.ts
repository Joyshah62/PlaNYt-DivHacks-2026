import { respond } from "../http";
import { searchPlaces } from "../places";

/** GET /api/trips/places?q= - named NYC places as you type, for suggesting stops. */
export async function GET(request: Request) {
  return respond(async () => {
    const q = (new URL(request.url).searchParams.get("q") ?? "").slice(0, 80);
    return { results: await searchPlaces(q) };
  });
}
