"use client";

import { Loader2, Pause, Volume2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { useTextToSpeech } from "@/lib/tts/useTextToSpeech";

export function SpeakButton({ text, label = "Listen", className = "" }: { text: string; label?: string; className?: string }) {
  const speech = useTextToSpeech();
  const { stop } = speech;
  const previousText = useRef(text);
  useEffect(() => {
    if (previousText.current !== text) stop();
    previousText.current = text;
  }, [stop, text]);
  return <span className={`inline-flex items-center gap-2 ${className}`}>
    <button
      type="button"
      onClick={() => speech.isSpeaking || speech.isLoading ? speech.stop() : speech.canResume ? void speech.resume() : void speech.speak(text)}
      aria-label={speech.isSpeaking || speech.isLoading ? "Stop speech" : speech.canResume ? "Play generated speech" : label}
      title={speech.isSpeaking || speech.isLoading ? "Stop speech" : speech.canResume ? "Play generated speech" : label}
      className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-brand/25 px-2.5 text-xs font-medium text-brand hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      {speech.isLoading ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : speech.isSpeaking ? <Pause className="size-3.5" aria-hidden /> : <Volume2 className="size-3.5" aria-hidden />}
      {speech.isLoading ? "Starting" : speech.isSpeaking ? "Stop" : speech.canResume ? "Play audio" : label}
    </button>
    {speech.error && <span role="status" className="text-xs text-sev-c">{speech.error}</span>}
  </span>;
}
