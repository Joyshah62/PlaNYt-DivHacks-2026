import { afterEach, describe, expect, it, vi } from "vitest";
import { hasElevenLabs, speechToText, textToSpeech } from "@/lib/elevenlabs";

describe("elevenlabs helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.ELEVENLABS_API_KEY;
  });

  it("reports missing key", () => {
    expect(hasElevenLabs()).toBe(false);
  });

  it("transcribes audio when the API returns text", async () => {
    process.env.ELEVENLABS_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ text: "Find pizza near the Met" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    expect(hasElevenLabs()).toBe(true);
    await expect(speechToText(Buffer.from("fake-audio"), { mimeType: "audio/mpeg" })).resolves.toBe("Find pizza near the Met");
  });

  it("synthesizes speech bytes", async () => {
    process.env.ELEVENLABS_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(new Uint8Array([1, 2, 3, 4]), { status: 200, headers: { "content-type": "audio/mpeg" } })),
    );
    const out = await textToSpeech("Hello from Roam");
    expect(out.mimeType).toBe("audio/mpeg");
    expect(out.audio.equals(Buffer.from([1, 2, 3, 4]))).toBe(true);
  });
});
