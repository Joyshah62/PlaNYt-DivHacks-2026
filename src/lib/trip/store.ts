import { getDb, hasMongo } from "@/lib/mongo";
import { memoryBackend } from "./memory";
import { mongoBackend } from "./mongo";
import { createTripService, type TripService } from "./service";

let service: TripService | null = null;

export function getTripStore(): TripService {
  if (service) return service;
  if (hasMongo()) {
    service = createTripService(mongoBackend(getDb));
  } else {
    if (process.env.NODE_ENV === "production") console.warn("[trips] MONGODB_URI is not set: trips live in memory and vanish on restart.");
    service = createTripService(memoryBackend());
  }
  return service;
}
