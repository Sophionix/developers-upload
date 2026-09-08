"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UseVoiceRecorderOptions {
  maxDurationMs?: number;
}

interface UseVoiceRecorderReturn {
  isRecording: boolean;
  isPaused: boolean;
  durationMs: number;
  start: () => Promise<void>;
  stop: () => Promise<Blob>;
  pause: () => void;
  resume: () => void;
  cancel: () => void;
  error: string | null;
}

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "audio/webm";
  for (const mime of [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg",
  ]) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return "audio/webm";
}

export function useVoiceRecorder(
  options: UseVoiceRecorderOptions = {},
): UseVoiceRecorderReturn {
  const { maxDurationMs } = options;

  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [durationMs, setDurationMs] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resolveStopRef = useRef<((blob: Blob) => void) | null>(null);
  const cancelledRef = useRef(false);

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const resetState = useCallback(() => {
    setIsRecording(false);
    setIsPaused(false);
    setDurationMs(0);
    chunksRef.current = [];
    resolveStopRef.current = null;
    cancelledRef.current = false;
    clearTimer();
    cleanupStream();
  }, [clearTimer, cleanupStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimer();
      if (recorderRef.current?.state !== "inactive") {
        try {
          recorderRef.current?.stop();
        } catch {
          // already stopped
        }
      }
      cleanupStream();
    };
  }, [clearTimer, cleanupStream]);

  const start = useCallback(async (): Promise<void> => {
    setError(null);
    cancelledRef.current = false;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      const msg =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Microphone permission denied"
          : "Could not access microphone";
      setError(msg);
      return;
    }

    streamRef.current = stream;
    const mimeType = pickMimeType();
    // Pin a low, speech-appropriate bitrate so long recordings stay small —
    // without this the browser's default (often 128kbps) blows past
    // UPLOAD_MAX_VOICE_BYTES well before the duration cap is reached.
    const recorder = new MediaRecorder(stream, {
      mimeType,
      audioBitsPerSecond: 32_000,
    });
    recorderRef.current = recorder;
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      clearTimer();
      cleanupStream();
      setIsRecording(false);
      setIsPaused(false);

      if (cancelledRef.current) {
        chunksRef.current = [];
        resolveStopRef.current = null;
        return;
      }

      const blob = new Blob(chunksRef.current, { type: mimeType });
      chunksRef.current = [];
      resolveStopRef.current?.(blob);
      resolveStopRef.current = null;
    };

    recorder.start(250); // collect chunks every 250ms
    setIsRecording(true);
    setIsPaused(false);
    setDurationMs(0);

    const startedAt = Date.now();
    let pausedAccum = 0;
    let pauseStart = 0;
    let lastSec = -1;

    timerRef.current = setInterval(() => {
      const paused = recorderRef.current?.state === "paused";
      if (paused) {
        if (pauseStart === 0) pauseStart = Date.now();
      } else {
        if (pauseStart > 0) {
          pausedAccum += Date.now() - pauseStart;
          pauseStart = 0;
        }
      }

      const elapsed = Date.now() - startedAt - pausedAccum - (pauseStart > 0 ? Date.now() - pauseStart : 0);
      // Only re-render once the displayed second actually changes — updating
      // state every 100ms churned the whole recorder row (32 waveform bars
      // included) and made the timer digits visibly flicker.
      const sec = Math.floor(elapsed / 1000);
      if (sec !== lastSec) {
        lastSec = sec;
        setDurationMs(elapsed);
      }

      if (maxDurationMs && elapsed >= maxDurationMs) {
        // Auto-stop at max duration
        if (recorderRef.current?.state !== "inactive") {
          recorderRef.current?.stop();
        }
      }
    }, 100);
  }, [maxDurationMs, clearTimer, cleanupStream]);

  const stop = useCallback((): Promise<Blob> => {
    return new Promise<Blob>((resolve, reject) => {
      if (!recorderRef.current || recorderRef.current.state === "inactive") {
        reject(new Error("Not recording"));
        return;
      }
      resolveStopRef.current = resolve;
      recorderRef.current.stop();
    });
  }, []);

  const pause = useCallback(() => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.pause();
      setIsPaused(true);
    }
  }, []);

  const resume = useCallback(() => {
    if (recorderRef.current?.state === "paused") {
      recorderRef.current.resume();
      setIsPaused(false);
    }
  }, []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    resetState();
  }, [resetState]);

  return {
    isRecording,
    isPaused,
    durationMs,
    start,
    stop,
    pause,
    resume,
    cancel,
    error,
  };
}
