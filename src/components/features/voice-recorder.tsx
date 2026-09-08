"use client";

import { useState } from "react";
import { Mic, Stop, Pause, Play, Loader2 } from "@/lib/ui/icons";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { useVoiceRecorder } from "@/hooks/use-voice-recorder";
import { attachVoiceNote } from "@/server/actions/voice-notes";
import { voiceMimeEnum } from "@/lib/validation/journal";

type VoiceMime = (typeof voiceMimeEnum.options)[number];

function normalizeVoiceMime(raw: string): VoiceMime {
  const base = raw.split(";")[0]!.trim() as VoiceMime;
  if (voiceMimeEnum.options.includes(base)) return base;
  return "audio/webm";
}

interface VoiceRecorderProps {
  entryId: string;
  onRecorded: (note: {
    id: string;
    durationMs: number;
    mimeType: string;
  }) => void;
  maxDurationMs?: number;
  disabled?: boolean;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function VoiceRecorder({
  entryId,
  onRecorded,
  maxDurationMs,
  disabled = false,
}: VoiceRecorderProps) {
  const [isUploading, setIsUploading] = useState(false);

  const {
    isRecording,
    isPaused,
    durationMs,
    start,
    stop,
    pause,
    resume,
    cancel: _cancel,
    error: recorderError,
  } = useVoiceRecorder(
    maxDurationMs === undefined ? {} : { maxDurationMs },
  );

  async function handleStart() {
    await start();
  }

  async function handleStop() {
    let blob: Blob;
    try {
      blob = await stop();
    } catch {
      toast.error("Recording failed");
      return;
    }

    setIsUploading(true);
    const recordedDurationMs = durationMs;

    try {
      // 1. Get signed upload URL
      const urlRes = await fetch("/api/journal/voice-notes/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentType: normalizeVoiceMime(blob.type),
          sizeBytes: blob.size,
          entryId,
        }),
      });

      if (!urlRes.ok) {
        const body = await urlRes.json().catch(() => null);
        throw new Error(
          (body as Record<string, unknown> | null)?.code as string ?? "Failed to get upload URL",
        );
      }

      const { url, path, headers } = (await urlRes.json()) as {
        url: string;
        path: string;
        headers: Record<string, string>;
      };

      // 2. Upload blob to signed URL
      const uploadRes = await fetch(url, {
        method: "PUT",
        headers: {
          "Content-Type": normalizeVoiceMime(blob.type),
          ...headers,
        },
        body: blob,
      });

      if (!uploadRes.ok) {
        throw new Error("Upload failed");
      }

      // 3. Attach voice note via server action
      const mime = normalizeVoiceMime(blob.type);
      const result = await attachVoiceNote({
        entryId,
        path,
        mime,
        durationMs: recordedDurationMs,
      });

      // 4. Notify parent
      onRecorded({
        id: result.id,
        durationMs: recordedDurationMs,
        mimeType: blob.type,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Voice note upload failed";
      toast.error(message);
    } finally {
      setIsUploading(false);
    }
  }

  if (recorderError) {
    toast.error(recorderError);
  }

  return (
    <div className="rounded-xl border border-white/20 bg-surface p-4">
      {isUploading ? (
        /* Uploading state */
        <div className="flex items-center justify-center gap-3">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Uploading...</span>
        </div>
      ) : isRecording ? (
        /* Recording state */
        <div className="flex items-center gap-4">
          {/* Animated pulse indicator */}
          <span className="relative flex size-3">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex size-3 rounded-full bg-red-500" />
          </span>

          {/* Duration timer */}
          <span className="min-w-[4ch] font-mono text-sm tabular-nums text-foreground">
            {formatDuration(durationMs)}
          </span>

          <div className="ml-auto flex items-center gap-2">
            {/* Pause / Resume */}
            {isPaused ? (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={resume}
                aria-label="Resume recording"
              >
                <Play />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={pause}
                aria-label="Pause recording"
              >
                <Pause />
              </Button>
            )}

            {/* Stop */}
            <Button
              variant="destructive"
              size="icon-sm"
              onClick={handleStop}
              aria-label="Stop recording"
            >
              <Stop />
            </Button>
          </div>
        </div>
      ) : (
        /* Idle state */
        <div className="flex items-center justify-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleStart}
            disabled={disabled}
            aria-label="Start recording"
          >
            <Mic className="size-5" />
          </Button>
        </div>
      )}
    </div>
  );
}
