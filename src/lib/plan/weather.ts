import type { Forecast, HourWeather } from "./weatherCodes";

const OPEN_METEO = "https://api.open-meteo.com/v1/forecast";
/** The National Weather Service's hourly forecast for Midtown (grid OKX 34,44): free, official, ~7 days. */
const NWS_HOURLY = "https://api.weather.gov/gridpoints/OKX/34,44/forecast/hourly";
const USER_AGENT = "PlaNYt (planyt.tech)";

/** A forecast is good for an hour; after a failure, an older one beats none for up to 12. */
const FRESH_MS = 60 * 60 * 1000;
const STALE_MS = 12 * 60 * 60 * 1000;
/** Open-Meteo's free tier limits by IP, and hosts share IPs: after a refusal, leave it alone for a while. */
const BACKOFF_MS = 15 * 60 * 1000;

let cached: { at: number; value: Forecast } | null = null;
let inFlight: Promise<Forecast | null> | null = null;
let openMeteoOffUntil = 0;

/**
 * Midtown's forecast from Open-Meteo (16 days), or the National Weather Service (about 7) when
 * Open-Meteo is refusing us. One point is enough: a visitor's day rarely spans weather that
 * differs by borough. Everyone asking at once shares one request.
 */
export async function nycForecast(): Promise<Forecast | null> {
  if (cached && Date.now() - cached.at < FRESH_MS) return cached.value;
  inFlight ??= refresh().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function refresh(): Promise<Forecast | null> {
  const value = (Date.now() >= openMeteoOffUntil ? await fromOpenMeteo() : null) ?? (await fromNws());
  if (value) {
    cached = { at: Date.now(), value };
    return value;
  }
  return cached && Date.now() - cached.at < STALE_MS ? cached.value : null;
}

async function fromOpenMeteo(): Promise<Forecast | null> {
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
    const res = await fetch(`${OPEN_METEO}?${params}`, { signal: AbortSignal.timeout(8000), cache: "no-store" });
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
    return value;
  } catch (error) {
    openMeteoOffUntil = Date.now() + BACKOFF_MS;
    console.warn("[weather] Open-Meteo unavailable, using the National Weather Service:", error instanceof Error ? error.message : error);
    return null;
  }
}

/** The NWS words ("Chance Rain Showers", "Mostly Sunny") as the WMO codes the app reads. */
export function nwsCode(text: string): number {
  const t = text.toLowerCase();
  if (/thunder|t-storm/.test(t)) return 95;
  if (/snow|sleet|flurr|ice|wintry/.test(t)) return 71;
  if (/shower/.test(t)) return 80;
  if (/rain/.test(t)) return 61;
  if (/drizzle/.test(t)) return 51;
  if (/fog|haze|smoke|mist/.test(t)) return 45;
  if (/partly|mostly sunny|mostly clear/.test(t)) return 2;
  if (/cloudy|overcast/.test(t)) return 3;
  if (/sunny|clear|fair/.test(t)) return 0;
  return 3;
}

/** How bad each code is for a day out, to pick the one that sums up a day. */
const SEVERITY: Record<number, number> = { 0: 0, 2: 1, 3: 2, 45: 3, 51: 4, 61: 5, 80: 5, 71: 6, 95: 7 };

async function fromNws(): Promise<Forecast | null> {
  try {
    const res = await fetch(NWS_HOURLY, { headers: { "User-Agent": USER_AGENT, Accept: "application/geo+json" }, signal: AbortSignal.timeout(8000), cache: "no-store" });
    if (!res.ok) throw new Error(`the Weather Service responded ${res.status}`);
    const periods = ((await res.json()) as { properties?: { periods?: { startTime: string; temperature: number; temperatureUnit: string; shortForecast: string; probabilityOfPrecipitation?: { value: number | null } }[] } }).properties?.periods ?? [];
    if (!periods.length) throw new Error("the Weather Service sent no hours");
    const hours: Record<string, HourWeather[]> = {};
    for (const p of periods) {
      // Local times ("2026-09-27T08:00:00-04:00"): the date and hour are New York's.
      const date = p.startTime.slice(0, 10);
      const hour = Number(p.startTime.slice(11, 13));
      const temp = p.temperatureUnit === "C" ? p.temperature * 1.8 + 32 : p.temperature;
      (hours[date] ??= [])[hour] = { temp: Math.round(temp), rain: p.probabilityOfPrecipitation?.value ?? 0, code: nwsCode(p.shortForecast) };
    }
    const days = Object.entries(hours).map(([date, list]) => {
      const known = list.filter(Boolean);
      // The day's weather is its worst daytime hour; rain or snow counts only when it's likely.
      const daytime = list.slice(8, 21).filter(Boolean);
      const severity = (h: HourWeather) => (h.code >= 51 && h.rain < 30 ? SEVERITY[3] : (SEVERITY[h.code] ?? SEVERITY[3]));
      const worst = (daytime.length ? daytime : known).reduce((a, b) => (severity(b) > severity(a) ? b : a));
      return { date, code: worst.code, hi: Math.max(...known.map((h) => h.temp)), lo: Math.min(...known.map((h) => h.temp)), rain: Math.max(...known.map((h) => h.rain)) };
    });
    return { days, hours };
  } catch (error) {
    console.error("[weather] no forecast from the Weather Service either:", error instanceof Error ? error.message : error);
    return null;
  }
}

/** For tests: forget what's cached. */
export function resetWeatherCache() {
  cached = null;
  inFlight = null;
  openMeteoOffUntil = 0;
}
