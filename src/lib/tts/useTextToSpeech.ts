"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { TTS_MODEL_ID, TTS_OUTPUT_FORMAT, TTS_VOICE_ID, TTS_VOICE_SETTINGS } from "./config";

type State = "idle" | "loading" | "speaking" | "error";
type AudioChunk = { audio?: string; is_final?: boolean };
let stopActiveSpeech: (() => void) | null = null;
let activeOwner: string | null = null;

export function stopCurrentSpeech() {
  stopActiveSpeech?.();
}

const audioBuffer = (chunk: Uint8Array) => chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength) as ArrayBuffer;

export function normalizeSpeech(text: string) {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/^\s*(?:[-+*]|\d+\.)\s+/gm, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[*_#>~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function useTextToSpeech() {
  const instanceId = useId();
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState("");
  const [canResume, setCanResume] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sourceRef = useRef<MediaSource | null>(null);
  const sourceBufferRef = useRef<SourceBuffer | null>(null);
  const pendingRef = useRef<Uint8Array[]>([]);
  const fallbackRef = useRef<Uint8Array[]>([]);
  const urlsRef = useRef<string[]>([]);
  const generationRef = useRef(0);
  const setStatus = useCallback((next: State) => setState(next), []);

  const stop = useCallback(() => {
    generationRef.current++;
    if (activeOwner === instanceId) {
      stopActiveSpeech = null;
      activeOwner = null;
    }
    socketRef.current?.close();
    socketRef.current = null;
    audioRef.current?.pause();
    audioRef.current?.removeAttribute("src");
    audioRef.current?.load();
    audioRef.current = null;
    if (sourceRef.current?.readyState === "open") {
      try { sourceRef.current.endOfStream(); } catch { /* the source may be updating */ }
    }
    sourceRef.current = null;
    sourceBufferRef.current = null;
    pendingRef.current = [];
    fallbackRef.current = [];
    urlsRef.current.forEach(URL.revokeObjectURL);
    urlsRef.current = [];
    setStatus("idle");
    setCanResume(false);
  }, [instanceId, setStatus]);

  const speak = useCallback(async (raw: string) => {
    stop();
    stopActiveSpeech?.();
    const text = normalizeSpeech(raw);
    if (!text || !TTS_VOICE_ID) {
      setError(!text ? "There is no text to speak." : "Set NEXT_PUBLIC_ELEVENLABS_VOICE_ID to enable speech.");
      setStatus("error");
      return;
    }
    if (text.length > 40_000) {
      setError("This response is too long to speak at once.");
      setStatus("error");
      return;
    }

    stopActiveSpeech = stop;
    activeOwner = instanceId;
    const generation = generationRef.current;
    setError("");
    setCanResume(false);
    setStatus("loading");
    try {
      const response = await fetch("/api/tts-token", { method: "POST", cache: "no-store" });
      const body = await response.json() as { token?: string; error?: string };
      if (!response.ok || !body.token) throw new Error(body.error ?? "Couldn't start speech playback.");
      if (generation !== generationRef.current) return;

      const params = new URLSearchParams({ single_use_token: body.token, model_id: TTS_MODEL_ID, output_format: TTS_OUTPUT_FORMAT, auto_mode: "true" });
      const socket = new WebSocket(`wss://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(TTS_VOICE_ID)}/stream-input?${params}`);
      socketRef.current = socket;
      let gotAudio = false;
      let ended = false;
      let mediaSource: MediaSource | null = null;
      let sourceBuffer: SourceBuffer | null = null;

      const append = (chunk: Uint8Array) => {
        if (generation !== generationRef.current) return;
        if (!gotAudio) {
          gotAudio = true;
          setStatus("speaking");
          if (typeof MediaSource !== "undefined" && MediaSource.isTypeSupported("audio/mpeg")) {
            mediaSource = new MediaSource();
            sourceRef.current = mediaSource;
            const audio = new Audio();
            audioRef.current = audio;
            const url = URL.createObjectURL(mediaSource);
            urlsRef.current.push(url);
            audio.src = url;
            mediaSource.addEventListener("sourceopen", onSourceOpen, { once: true });
          }
        }
        if (sourceBuffer && !sourceBuffer.updating) sourceBuffer.appendBuffer(audioBuffer(chunk));
        else pendingRef.current.push(chunk);
        if (!mediaSource || !sourceBuffer) fallbackRef.current.push(chunk);
      };

      const playFallback = () => {
        if (generation !== generationRef.current || !fallbackRef.current.length) return;
        const url = URL.createObjectURL(new Blob(fallbackRef.current as BlobPart[], { type: "audio/mpeg" }));
        urlsRef.current.push(url);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => { setCanResume(false); setStatus("idle"); };
        void audio.play().then(() => setStatus("speaking")).catch(() => {
          setCanResume(true);
          setError("Audio is ready. Press play to start it.");
          setStatus("error");
        });
      };

      function onSourceOpen() {
        if (generation !== generationRef.current || !mediaSource) return;
        try {
          sourceBuffer = mediaSource.addSourceBuffer("audio/mpeg");
          sourceBufferRef.current = sourceBuffer;
          sourceBuffer.addEventListener("updateend", () => {
            const next = pendingRef.current.shift();
            if (next && sourceBuffer && !sourceBuffer.updating) sourceBuffer.appendBuffer(audioBuffer(next));
            else if (ended && sourceBuffer && !sourceBuffer.updating && mediaSource?.readyState === "open") mediaSource.endOfStream();
          });
          const buffered = pendingRef.current.splice(0);
          const first = buffered.shift();
          pendingRef.current.push(...buffered);
          if (first) sourceBuffer.appendBuffer(audioBuffer(first));
          fallbackRef.current = [];
          void audioRef.current?.play().catch(() => {
            setCanResume(true);
            setError("Audio is ready. Press play to start it.");
            setStatus("error");
          });
        } catch {
          sourceBuffer = null;
          sourceBufferRef.current = null;
          mediaSource = null;
          sourceRef.current = null;
          playFallback();
        }
      }

      const fail = (message: string) => {
        if (generation !== generationRef.current) return;
        setError(message);
        setStatus("error");
        socket.close();
      };

      socket.addEventListener("open", () => {
        if (generation !== generationRef.current) return socket.close();
        socket.send(JSON.stringify({ text: " ", voice_settings: TTS_VOICE_SETTINGS }));
        socket.send(JSON.stringify({ text: `${text} `, try_trigger_generation: true }));
        socket.send(JSON.stringify({ text: "" }));
      }, { once: true });
      socket.addEventListener("message", (event) => {
        if (generation !== generationRef.current || typeof event.data !== "string") return;
        try {
          const message = JSON.parse(event.data) as AudioChunk & { message?: string };
          if (message.audio) {
            const bytes = Uint8Array.from(atob(message.audio), (c) => c.charCodeAt(0));
            append(bytes);
          }
          if (message.is_final) {
            ended = true;
            if (mediaSource?.readyState === "open" && sourceBuffer && !sourceBuffer.updating) mediaSource.endOfStream();
            socket.close();
            if (!gotAudio) fail("The speech service returned no audio.");
          }
          if (message.message && !message.audio) fail("Speech generation failed. Please try again.");
        } catch {
          fail("Couldn't process the speech response.");
        }
      });
      socket.addEventListener("error", () => fail("Couldn't connect to the speech service."), { once: true });
      socket.addEventListener("close", (event) => {
        if (generation !== generationRef.current) return;
        if (event.code !== 1000 && !ended) return fail("The speech connection closed unexpectedly.");
        if (!gotAudio || !fallbackRef.current.length) {
          if (!ended) fail("The speech service returned no audio.");
          else setStatus("idle");
          return;
        }
        if (!mediaSource) {
          playFallback();
        } else {
          audioRef.current?.addEventListener("ended", () => { setCanResume(false); setStatus("idle"); }, { once: true });
        }
      }, { once: true });
    } catch (cause) {
      if (generation !== generationRef.current) return;
      setError(cause instanceof Error ? cause.message : "Speech playback failed.");
      setStatus("error");
    }
  }, [instanceId, setStatus, stop]);

  const resume = useCallback(async () => {
    try {
      await audioRef.current?.play();
      setCanResume(false);
      setError("");
      setStatus("speaking");
    } catch {
      setError("Your browser is still blocking audio playback.");
    }
  }, [setStatus]);

  useEffect(() => () => stop(), [stop]);
  return { speak, stop, resume, canResume, isLoading: state === "loading", isSpeaking: state === "speaking", error, state };
}
