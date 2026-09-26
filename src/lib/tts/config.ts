export const TTS_MODEL_ID = "eleven_flash_v2_5";
export const TTS_OUTPUT_FORMAT = "mp3_44100_128";
export const TTS_VOICE_ID = process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID ?? "";
export const TTS_VOICE_SETTINGS = { stability: 0.5, similarity_boost: 0.75, speed: 1 };
