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
