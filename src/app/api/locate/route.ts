import { titleCaseAddress } from "@/lib/nyc/analyze";
import { AddressNotFoundError, resolveAddress } from "@/lib/nyc/geosearch";

/**
 * Address → point, fast. The report page calls this first so the map and the
 * neighborhood can start loading while the slower housing-record queries run.
 */
export async function GET(request: Request) {
  const address = new URL(request.url).searchParams.get("address")?.trim();
  if (!address) {
    return Response.json({ error: "Enter an NYC address to check a building." }, { status: 400 });
  }

  try {
    const resolved = await resolveAddress(address);
    return Response.json({
      label: titleCaseAddress(resolved.label),
      borough: resolved.borough,
      zip: resolved.zip,
      bin: resolved.bin,
      location: resolved.lat !== null && resolved.lon !== null ? { lat: resolved.lat, lon: resolved.lon } : null,
    });
  } catch (error) {
    if (error instanceof AddressNotFoundError) {
      return Response.json(
        {
          error: "We couldn't find that NYC address.",
          hint: "Try including the borough, for example “123 Bedford Ave, Brooklyn”.",
        },
        { status: 404 },
      );
    }
    console.error("[locate] address lookup failed:", error);
    return Response.json({ error: "Address lookup is temporarily unavailable. Please try again." }, { status: 503 });
  }
}
