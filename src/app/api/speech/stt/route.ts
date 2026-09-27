import { ElevenLabsError, hasElevenLabs, speechToText } from "@/lib/elevenlabs";

export const runtime = "nodejs";

/** POST /api/speech/stt — multipart field `audio` (or `file`) → { text }. */
export async function POST(req: Request) {
  if (!hasElevenLabs()) {
    return Response.json({ error: "Speech-to-text isn't set up on this server." }, { status: 503 });
  }
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "Expected multipart form data with an audio file." }, { status: 400 });
  }
  const file = form.get("audio") ?? form.get("file");
  if (!(file instanceof File) || !file.size) {
    return Response.json({ error: "Attach an audio file as `audio`." }, { status: 400 });
  }
  if (file.size > 25 * 1024 * 1024) {
    return Response.json({ error: "That recording is too large (25 MB max)." }, { status: 413 });
  }
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const text = await speechToText(buf, {
      filename: file.name || "recording.webm",
      mimeType: file.type || "audio/webm",
      languageCode: typeof form.get("language") === "string" ? (form.get("language") as string) : "en",
    });
    return Response.json({ text });
  } catch (error) {
    const message = error instanceof ElevenLabsError ? error.message : "Couldn't transcribe that.";
    console.error("[speech/stt]", error);
    return Response.json({ error: message }, { status: 502 });
  }
}
