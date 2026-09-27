import { describe, expect, it, vi } from "vitest";
import { progressResponse, readProgress } from "./progress";

describe("live progress", () => {
  it("keeps plain JSON clients compatible", async () => {
    const res = await progressResponse(new Request("https://local/test"), async (progress) => {
      progress("Reading…");
      return Response.json({ message: "Done" });
    });
    expect(await res.json()).toEqual({ message: "Done" });
  });
  it("sends real stages before the final reply", async () => {
    const progress = vi.fn();
    const res = await progressResponse(new Request("https://local/test", { headers: { accept: "application/x-ndjson" } }), async (send) => {
      send("Searching the web…");
      send("Building your plan…");
      return Response.json({ message: "Done" });
    });
    expect(await readProgress(res, progress)).toEqual({ message: "Done" });
    expect(progress.mock.calls.flat()).toEqual(["Searching the web…", "Building your plan…"]);
  });
  it("surfaces validation failures from streamed responses", async () => {
    const res = await progressResponse(new Request("https://local/test", { headers: { accept: "application/x-ndjson" } }), async () => Response.json({ error: "Please choose a stop" }, { status: 422 }));
    await expect(readProgress(res, () => {})).rejects.toThrow("Please choose a stop");
  });
  it("handles split JSON and Unicode chunks without losing stages", async () => {
    const bytes = new TextEncoder().encode(JSON.stringify({ type: "progress", message: "Looking up cafés…" }) + "\n" + JSON.stringify({ type: "result", status: 200, body: { ok: true } }));
    const response = new Response(new ReadableStream({ start(c) { for (const byte of bytes) c.enqueue(new Uint8Array([byte])); c.close(); } }), { headers: { "content-type": "application/x-ndjson" } });
    const progress = vi.fn();
    expect(await readProgress(response, progress)).toEqual({ ok: true });
    expect(progress).toHaveBeenCalledWith("Looking up cafés…");
  });
  it("reports an interrupted stream instead of leaving the user waiting", async () => {
    const response = new Response('{"type":"progress","message":"Working…"}\n', { headers: { "content-type": "application/x-ndjson" } });
    await expect(readProgress(response, () => {})).rejects.toThrow("interrupted");
  });
});
