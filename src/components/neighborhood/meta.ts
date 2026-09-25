import type { CSSProperties } from "react";
import {
  Briefcase,
  Bus,
  Clock,
  Coffee,
  CookingPot,
  Drama,
  Dumbbell,
  GraduationCap,
  MapPin,
  Martini,
  Moon,
  Pill,
  Pizza,
  ShoppingBasket,
  Soup,
  Stethoscope,
  Store,
  TrainFront,
  Trees,
  UtensilsCrossed,
  WashingMachine,
  type LucideIcon,
} from "lucide-react";
import type { CategoryId, DestinationKind } from "@/lib/osm/types";
import type { PreferenceId } from "@/lib/preferences";

export const CATEGORY_ICONS: Record<CategoryId, LucideIcon> = {
  groceries: ShoppingBasket,
  restaurants: UtensilsCrossed,
  coffee: Coffee,
  subway: TrainFront,
  parks: Trees,
  fitness: Dumbbell,
  pharmacy: Pill,
  nightlife: Martini,
  convenience: Store,
  laundry: WashingMachine,
  entertainment: Drama,
  health: Stethoscope,
  bus: Bus,
};

export const PREFERENCE_ICONS: Record<PreferenceId, LucideIcon> = {
  commute: Clock,
  transit: TrainFront,
  groceries: ShoppingBasket,
  restaurants: UtensilsCrossed,
  indian: CookingPot,
  asian: Soup,
  italian: Pizza,
  coffee: Coffee,
  nightlife: Martini,
  quiet: Moon,
  fitness: Dumbbell,
  parks: Trees,
  entertainment: Drama,
  pharmacy: Pill,
  laundry: WashingMachine,
};

export const DESTINATION_ICONS: Record<DestinationKind, LucideIcon> = {
  work: Briefcase,
  school: GraduationCap,
  other: MapPin,
  preset: MapPin,
};

/** Sets `--c` so children can use `text-(--c)`, `bg-(--c)/10`, etc. */
export function categoryStyle(id: CategoryId | null): CSSProperties {
  return { "--c": id ? `var(--cat-${id})` : "var(--brand)" } as CSSProperties;
}
