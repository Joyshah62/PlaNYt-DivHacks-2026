export class TripApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function tripApi<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(
    `/api/trips${path}`,
    body === undefined
      ? { cache: "no-store" }
      : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) },
  );
  const data = (await res.json().catch(() => ({}))) as { error?: unknown };
  if (!res.ok) throw new TripApiError(res.status, typeof data.error === "string" ? data.error : "Something went wrong.");
  return data as T;
}

/** A request that took too long: the server may be slow rather than unreachable. */
export class TripTimeoutError extends Error {}

/**
 * The trip, or null when it hasn't changed since `etag` (the server answers 304). Gives up
 * after 10 s so a slow server shows as slow, not as a frozen room.
 */
export async function fetchTrip<T>(id: string, etag: string | null): Promise<{ trip: T | null; etag: string | null }> {
  let res: Response;
  try {
    res = await fetch(`/api/trips/${id}`, { cache: "no-store", headers: etag ? { "if-none-match": etag } : {}, signal: AbortSignal.timeout(10_000) });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") throw new TripTimeoutError("The trip is taking a while to load.");
    throw error;
  }
  if (res.status === 304) return { trip: null, etag };
  const data = (await res.json().catch(() => ({}))) as { error?: unknown };
  if (!res.ok) throw new TripApiError(res.status, typeof data.error === "string" ? data.error : "Something went wrong.");
  return { trip: data as T, etag: res.headers.get("etag") };
}
