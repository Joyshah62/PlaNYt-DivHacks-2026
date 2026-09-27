/** Words that ask about where the traveler is right now. */
export const NEAR_ME = /\b(near me|nearby|near by|around me|around here|close to me|close by|where i am|my location|near here|walking distance)\b/i;

/** The device's position, or null when it can't or won't share it. Browser only. */
export function locate(): Promise<{ lat: number; lon: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  });
}
