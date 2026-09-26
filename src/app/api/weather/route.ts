import { nycForecast } from "@/lib/plan/weather";

/** GET /api/weather - the next 16 days in NYC, daily and hourly. */
export async function GET() {
  const forecast = await nycForecast();
  if (!forecast) return Response.json({ error: "The forecast isn't available right now." }, { status: 502 });
  return Response.json(forecast, { headers: { "Cache-Control": "public, max-age=1800" } });
}
