import { memoryBackend } from "./memory";
import { createTripService, type TripService } from "./service";

let service: TripService | null = null;

export function getTripStore(): TripService {
  return (service ??= createTripService(memoryBackend()));
}
