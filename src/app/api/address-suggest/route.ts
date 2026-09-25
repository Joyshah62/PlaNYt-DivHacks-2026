import { suggestAddresses } from "@/lib/nyc/geosearch";

export async function GET(request: Request) {
  const text = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  try {
    return Response.json(await suggestAddresses(text));
  } catch {
    // Type-ahead is a convenience; failing it silently is better than an error toast.
    return Response.json([]);
  }
}
