import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Sun, type LucideProps } from "lucide-react";
import { WEATHER_LABEL, weatherKind, type WeatherKind } from "@/lib/plan/weatherCodes";

const ICON: Record<WeatherKind, typeof Sun> = {
  sun: Sun,
  partly: CloudSun,
  cloud: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  snow: CloudSnow,
  storm: CloudLightning,
};

export function WeatherIcon({ code, className, ...rest }: { code: number } & LucideProps) {
  const kind = weatherKind(code);
  const Icon = ICON[kind];
  // Set in the surrounding ink, like the rest of the page.
  return <Icon aria-label={WEATHER_LABEL[kind]} className={className} {...rest} />;
}
