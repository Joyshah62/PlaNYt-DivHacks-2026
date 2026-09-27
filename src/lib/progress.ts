export type Progress = (message: string) => void;
type Event = { type: "progress"; message: string } | { type: "result"; status: number; body: unknown };

/** Opt-in progress keeps existing JSON clients working. Stages come from real work. */
export function progressResponse(req: Request, work: (progress: Progress) => Promise<Response>): Promise<Response> | Response {
  if (!req.headers.get("accept")?.includes("application/x-ndjson")) return work(() => {});
  const encoder = new TextEncoder();
  let closed = false;
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: Event) => { if (!closed) controller.enqueue(encoder.encode(JSON.stringify(event) + "\n")); };
      try {
        const response = await work((message) => send({ type: "progress", message }));
        send({ type: "result", status: response.status, body: await response.json() });
      } catch {
        send({ type: "result", status: 503, body: { error: "Couldn't complete that request. Please try again." } });
      } finally {
        if (!closed) { closed = true; controller.close(); }
      }
    },
    cancel() { closed = true; },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson", "cache-control": "no-cache, no-transform", "x-accel-buffering": "no" } });
}

export async function readProgress<T>(response: Response, progress: Progress): Promise<T> {
  const unwrap = (body: unknown, status: number): T => {
    if (status >= 400) throw new Error((body as { error?: string })?.error ?? "Couldn't complete that request.");
    return body as T;
  };
  if (!response.headers.get("content-type")?.includes("application/x-ndjson")) return unwrap(await response.json(), response.status);
  const reader = response.body?.getReader();
  if (!reader) throw new Error("The response was interrupted. Please try again.");
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split("\n"); buffer = lines.pop() ?? "";
      if (done && buffer.trim()) lines.push(buffer);
      for (const line of lines.filter((line) => line.trim())) {
        const event = JSON.parse(line) as Event;
        if (event.type === "progress") progress(event.message);
        else if (event.type === "result") return unwrap(event.body, event.status);
      }
      if (done) throw new Error("The response was interrupted. Please try again.");
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
