/**
 * ElevenLabs Speech-to-Text and Text-to-Speech.
 * https://elevenlabs.io/docs/api-reference
 *
 * Env:
 *   ELEVENLABS_API_KEY   — required to enable
 *   ELEVENLABS_VOICE_ID  — TTS voice (default: Rachel from ElevenLabs docs)
 *   ELEVENLABS_TTS_MODEL — default eleven_flash_v2_5 (fast)
 *   ELEVENLABS_STT_MODEL — default scribe_v2
 */

const API = "https://api.elevenlabs.io/v1";
const DEFAULT_VOICE = "JBFqnCBsd6RMkjVDRZzb";

export function elevenLabsKey(): string {
  return process.env.ELEVENLABS_API_KEY?.trim() ?? "";
}

export function hasElevenLabs(): boolean {
  return !!elevenLabsKey();
}

export class ElevenLabsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ElevenLabsError";
  }
}

function headers(): HeadersInit {
  const key = elevenLabsKey();
  if (!key) throw new ElevenLabsError("Speech isn't set up (missing ELEVENLABS_API_KEY).");
  return { "xi-api-key": key };
}

/** Transcribe audio bytes (voice note, webm/m4a/mp3/wav, …) to text. */
export async function speechToText(
  audio: Buffer | Uint8Array,
  opts: { filename?: string; mimeType?: string; languageCode?: string } = {},
): Promise<string> {
  const form = new FormData();
  const mime = opts.mimeType ?? "audio/mpeg";
  const name = opts.filename ?? "audio.mp3";
  const bytes = Uint8Array.from(audio instanceof Buffer ? audio : Buffer.from(audio));
  form.append("file", new Blob([bytes], { type: mime }), name);
  form.append("model_id", process.env.ELEVENLABS_STT_MODEL?.trim() || "scribe_v2");
  if (opts.languageCode) form.append("language_code", opts.languageCode);

  const res = await fetch(`${API}/speech-to-text`, {
    method: "POST",
    headers: headers(),
    body: form,
    signal: AbortSignal.timeout(90_000),
  });
  const body = (await res.json().catch(() => ({}))) as { text?: string; detail?: { message?: string } | string };
  if (!res.ok) {
    const detail = typeof body.detail === "string" ? body.detail : body.detail?.message;
    throw new ElevenLabsError(detail || `Speech-to-text failed (${res.status}).`);
  }
  const text = body.text?.trim() ?? "";
  if (!text) throw new ElevenLabsError("Couldn't hear anything in that recording.");
  return text;
}

/** Synthesize speech; returns mp3 bytes by default. */
export async function textToSpeech(
  text: string,
  opts: { voiceId?: string; modelId?: string } = {},
): Promise<{ audio: Buffer; mimeType: string }> {
  const trimmed = text.trim();
  if (!trimmed) throw new ElevenLabsError("Nothing to speak.");
  const voiceId = opts.voiceId || process.env.ELEVENLABS_VOICE_ID?.trim() || DEFAULT_VOICE;
  const modelId = opts.modelId || process.env.ELEVENLABS_TTS_MODEL?.trim() || "eleven_flash_v2_5";

  const res = await fetch(`${API}/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: { ...headers(), "content-type": "application/json", accept: "audio/mpeg" },
    body: JSON.stringify({
      text: trimmed.slice(0, 2500),
      model_id: modelId,
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: { message?: string } | string };
    const detail = typeof err.detail === "string" ? err.detail : err.detail?.message;
    throw new ElevenLabsError(detail || `Text-to-speech failed (${res.status}).`);
  }
  const audio = Buffer.from(await res.arrayBuffer());
  if (!audio.length) throw new ElevenLabsError("Text-to-speech returned empty audio.");
  return { audio, mimeType: "audio/mpeg" };
}
