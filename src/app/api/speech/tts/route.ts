import { z } from "zod";
import { ElevenLabsError, hasElevenLabs, textToSpeech } from "@/lib/elevenlabs";

export const runtime = "nodejs";

const Body = z.object({
  text: z.string().trim().min(1).max(2500),
  voiceId: z.string().trim().min(1).max(64).optional(),
});

/** POST /api/speech/tts { text } → audio/mpeg. */
export async function POST(req: Request) {
  if (!hasElevenLabs()) {
    return Response.json({ error: "Text-to-speech isn't set up on this server." }, { status: 503 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Send JSON { text } to speak." }, { status: 400 });
  }
  try {
    const { audio, mimeType } = await textToSpeech(parsed.data.text, { voiceId: parsed.data.voiceId });
    return new Response(new Uint8Array(audio), {
      status: 200,
      headers: {
        "content-type": mimeType,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof ElevenLabsError ? error.message : "Couldn't synthesize speech.";
    console.error("[speech/tts]", error);
    return Response.json({ error: message }, { status: 502 });
  }
}
