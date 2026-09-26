import type { Forecast } from "./weatherCodes";

const URL_ = "https://api.open-meteo.com/v1/forecast";
const TTL_MS = 30 * 60 * 1000;
let cached: { at: number; value: Forecast } | null = null;

/**
 * Midtown's forecast for the next 16 days from Open-Meteo (free, no key). One
 * point is enough: a visitor's day rarely spans weather that differs by borough.
 */
export async function nycForecast(): Promise<Forecast | null> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;
  const params = new URLSearchParams({
    latitude: "40.754",
    longitude: "-73.984",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    hourly: "temperature_2m,precipitation_probability,weather_code",
    timezone: "America/New_York",
    forecast_days: "16",
    temperature_unit: "fahrenheit",
  });
  try {
    const res = await fetch(`${URL_}?${params}`, { signal: AbortSignal.timeout(8000), cache: "no-store" });
    if (!res.ok) throw new Error(`Open-Meteo responded ${res.status}`);
    const body = (await res.json()) as {
      daily: { time: string[]; weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_probability_max: (number | null)[] };
      hourly: { time: string[]; temperature_2m: number[]; precipitation_probability: (number | null)[]; weather_code: number[] };
    };
    const value: Forecast = {
      days: body.daily.time.map((date, i) => ({
        date,
        code: body.daily.weather_code[i],
        hi: Math.round(body.daily.temperature_2m_max[i]),
        lo: Math.round(body.daily.temperature_2m_min[i]),
        rain: body.daily.precipitation_probability_max[i] ?? 0,
      })),
      hours: {},
    };
    body.hourly.time.forEach((t, i) => {
      const date = t.slice(0, 10);
      (value.hours[date] ??= []).push({
        temp: Math.round(body.hourly.temperature_2m[i]),
        rain: body.hourly.precipitation_probability[i] ?? 0,
        code: body.hourly.weather_code[i],
      });
    });
    cached = { at: Date.now(), value };
    return value;
  } catch (error) {
    console.error("[weather]", error instanceof Error ? error.message : error);
    return null;
  }
}
