import { afterEach, describe, expect, it, vi } from "vitest";
import { nwsCode, nycForecast, resetWeatherCache } from "./weather";

const meteo = {
  daily: { time: ["2026-10-03"], weather_code: [2], temperature_2m_max: [70.4], temperature_2m_min: [58.6], precipitation_probability_max: [10] },
  hourly: { time: ["2026-10-03T00:00"], temperature_2m: [60], precipitation_probability: [5], weather_code: [2] },
};
const nws = {
  properties: {
    periods: [
      { startTime: "2026-10-03T09:00:00-04:00", temperature: 61, temperatureUnit: "F", shortForecast: "Mostly Sunny", probabilityOfPrecipitation: { value: 5 } },
      { startTime: "2026-10-03T14:00:00-04:00", temperature: 68, temperatureUnit: "F", shortForecast: "Chance Rain Showers", probabilityOfPrecipitation: { value: 60 } },
    ],
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
  resetWeatherCache();
});

describe("NYC forecast", () => {
  it("asks once for everyone waiting, and keeps it for an hour", async () => {
    const fetch = vi.fn(async () => Response.json(meteo));
    vi.stubGlobal("fetch", fetch);
    const [a, b] = await Promise.all([nycForecast(), nycForecast()]);
    await nycForecast();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
    expect(a?.days[0]).toMatchObject({ date: "2026-10-03", hi: 70, lo: 59 });
  });

  it("falls back to the Weather Service when Open-Meteo refuses, and then leaves Open-Meteo alone", async () => {
    const fetch = vi.fn(async (url: string) => (String(url).includes("open-meteo") ? new Response("slow down", { status: 429 }) : Response.json(nws)));
    vi.stubGlobal("fetch", fetch);
    const f = await nycForecast();
    expect(f?.days[0]).toMatchObject({ date: "2026-10-03", hi: 68, lo: 61, rain: 60, code: 80 });
    expect(f?.hours["2026-10-03"][14]).toMatchObject({ temp: 68, rain: 60 });
    expect(fetch.mock.calls.filter(([u]) => String(u).includes("open-meteo"))).toHaveLength(1);
  });

  it("reads the Weather Service's words", () => {
    expect(nwsCode("Chance Rain Showers")).toBe(80);
    expect(nwsCode("Slight Chance Showers And Thunderstorms")).toBe(95);
    expect(nwsCode("Partly Cloudy")).toBe(2);
    expect(nwsCode("Sunny")).toBe(0);
  });
});
