export type WeatherKind = "sun" | "partly" | "cloud" | "fog" | "drizzle" | "rain" | "snow" | "storm";

/** WMO weather codes, as Open-Meteo reports them, folded into what a visitor cares about. */
export function weatherKind(code: number): WeatherKind {
  if (code <= 1) return "sun";
  if (code === 2) return "partly";
  if (code === 3) return "cloud";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 57) return "drizzle";
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code >= 95) return "storm";
  return "cloud";
}

export const WEATHER_LABEL: Record<WeatherKind, string> = {
  sun: "Sunny",
  partly: "Partly cloudy",
  cloud: "Cloudy",
  fog: "Foggy",
  drizzle: "Drizzle",
  rain: "Rain",
  snow: "Snow",
  storm: "Thunderstorms",
};

export interface DayWeather {
  date: string;
  code: number;
  hi: number;
  lo: number;
  /** Highest chance of rain in the day, 0-100. */
  rain: number;
}

export interface HourWeather {
  temp: number;
  rain: number;
  code: number;
}

export interface Forecast {
  days: DayWeather[];
  /** By date, 24 hours each (NYC local). */
  hours: Record<string, HourWeather[]>;
}
