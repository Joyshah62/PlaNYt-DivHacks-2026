/** POST /api/tts-token - return a short-lived, single-use token for browser TTS. */
export async function POST() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return Response.json({ error: "Speech playback isn't configured." }, { status: 503 });

  try {
    const response = await fetch("https://api.elevenlabs.io/v1/single-use-token/tts_websocket", {
      method: "POST",
      headers: { "xi-api-key": apiKey },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return Response.json({ error: "Couldn't start speech playback." }, { status: 502 });
    const body: unknown = await response.json();
    const token = typeof body === "object" && body !== null && "token" in body && typeof body.token === "string" ? body.token : "";
    if (!token) return Response.json({ error: "Couldn't start speech playback." }, { status: 502 });
    return Response.json({ token }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Couldn't reach the speech service." }, { status: 502 });
  }
}
