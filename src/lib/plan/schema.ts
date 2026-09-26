import { z } from "zod";
import { inNycArea } from "@/lib/osm/geo";
import { DEFAULT_PROFILE } from "./profile";

const point = { lat: z.number(), lon: z.number() };

export const StopSchema = z.object({
  key: z.string().min(1).max(80),
  name: z.string().min(1).max(120),
  ...point,
  visitMin: z.number().int().min(10).max(480),
  attractionId: z.string().max(40).nullable(),
  fixedStartMin: z.number().int().min(0).max(1439).nullable().optional(),
  mealFor: z.enum(["lunch", "dinner"]).nullable().optional(),
  hours: z.array(z.tuple([z.number().int().min(0).max(1440), z.number().int().min(1).max(2880)]).nullable()).length(7).nullable().optional(),
});

/** What /api/plan and /api/plan/compare accept. */
export const PlanRequestSchema = z
  .object({
    stops: z.array(StopSchema).min(1).max(10),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    startMin: z.number().int().min(0).max(1439),
    endMin: z.number().int().min(1).max(1440 + 180),
    mode: z.enum(["transit", "walk", "bike", "car"]),
    crowd: z.enum(["avoid", "balanced", "ignore"]),
    origin: z.object({ label: z.string().max(160), ...point }).nullable(),
    returnToOrigin: z.boolean(),
    // Optional so older share links and clients keep working.
    profile: z
      .object({
        pace: z.enum(["relaxed", "balanced", "packed"]),
        group: z.enum(["solo", "couple", "family", "seniors"]),
        walkMax: z.number().int().min(5).max(120).nullable(),
        interests: z.array(z.enum(["art", "views", "history", "outdoors", "food", "neighborhoods"])).max(6),
      })
      .default(DEFAULT_PROFILE),
    meals: z.object({ lunch: z.boolean(), dinner: z.boolean() }).default({ lunch: false, dinner: false }),
    keepOrder: z.boolean().optional(),
  })
  .refine((r) => r.endMin > r.startMin, { message: "The day must end after it starts." })
  .refine((r) => r.stops.every(inNycArea) && (!r.origin || inNycArea(r.origin)), { message: "Every place must be in New York City." })
  .refine((r) => new Set(r.stops.map((s) => s.key)).size === r.stops.length, { message: "Each stop can only appear once." });
