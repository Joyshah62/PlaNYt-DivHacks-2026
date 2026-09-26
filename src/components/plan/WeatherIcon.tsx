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

/** Sun and storm get their own colour; the rest stay quiet. */
const TONE: Partial<Record<WeatherKind, string>> = {
  sun: "text-sev-b",
  partly: "text-sev-b",
  rain: "text-(--cat-subway)",
  drizzle: "text-(--cat-subway)",
  storm: "text-sev-c",
};

export function WeatherIcon({ code, className, ...rest }: { code: number } & LucideProps) {
  const kind = weatherKind(code);
  const Icon = ICON[kind];
  return <Icon aria-label={WEATHER_LABEL[kind]} className={[TONE[kind] ?? "text-muted-foreground", className].filter(Boolean).join(" ")} {...rest} />;
}
