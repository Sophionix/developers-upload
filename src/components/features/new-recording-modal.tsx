"use client";

import * as React from "react";
import { AppModal } from "@/components/ui/app-modal";
import { Button } from "@/components/ui/button";
import { Mic, Stop, Pause, Play, Loader2 } from "@/lib/ui/icons";
import { toast } from "@/components/ui/toast";
import { useVoiceRecorder } from "@/hooks/use-voice-recorder";
import { createJournalEntry } from "@/server/actions/journal";
import { voiceMimeEnum } from "@/lib/validation/journal";
import { cn } from "@/lib/ui/cn";

type VoiceMime = (typeof voiceMimeEnum.options)[number];

function normalizeVoiceMime(raw: string): VoiceMime {
  const base = raw.split(";")[0]!.trim() as VoiceMime;
  if (voiceMimeEnum.options.includes(base)) return base;
  return "audio/webm";
}

interface NewRecordingModalProps {
  onClose: () => void;
  onSaved: () => void;
}

const BAR_COUNT = 32;

function formatTimer(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function NewRecordingModal({ onClose, onSaved }: NewRecordingModalProps) {
  const [title, setTitle] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);
  const [recordedBlob, setRecordedBlob] = React.useState<Blob | null>(null);
  const [recordedDuration, setRecordedDuration] = React.useState(0);
  const [bars] = React.useState(() => {
    const arr: number[] = [];
    for (let i = 0; i < BAR_COUNT; i++) {
      arr.push(0.15 + Math.random() * 0.85);
    }
    return arr;
  });

  const {
    isRecording,
    isPaused,
    durationMs,
    start,
    stop,
    pause,
    resume,
    cancel,
    error: recorderError,
  } = useVoiceRecorder();

  React.useEffect(() => {
    if (recorderError) toast.error(recorderError);
  }, [recorderError]);

  async function handleStartRecording() {
    setRecordedBlob(null);
    await start();
  }

  async function handleStopRecording() {
    try {
      const blob = await stop();
      setRecordedBlob(blob);
      setRecordedDuration(durationMs);
    } catch {
      toast.error("Recording failed");
    }
  }

  async function handleSave() {
    if (!recordedBlob) {
      toast.error("Please record audio first");
      return;
    }

    setIsSaving(true);

    try {
      const entry = await createJournalEntry({
        title: title.trim() || "Untitled Recording",
        bodyHtml: "<p></p>",
        isDraft: false,
      });

      const mime = normalizeVoiceMime(recordedBlob.type);

      const form = new FormData();
      form.append("file", recordedBlob, `recording.${mime.split("/")[1] ?? "webm"}`);
      form.append("entryId", entry.id);
      form.append("contentType", mime);
      form.append("durationMs", String(recordedDuration));

      const uploadRes = await fetch("/api/journal/voice-notes/upload", {
        method: "POST",
        body: form,
      });

      if (!uploadRes.ok) {
        const data = (await uploadRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Upload failed");
      }

      toast.success("Recording saved");
      onSaved();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save recording";
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  }

  function handleClose() {
    if (isRecording) cancel();
    onClose();
  }

  const progress = recordedBlob ? 1 : 0;

  return (
    <AppModal title="New Recordings" onClose={handleClose}>
      <div className="flex flex-col gap-4">
        {/* Title input */}
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter Title.."
          className="w-full rounded-lg border border-white/20 bg-surface px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />

        {/* Recorder area */}
        <div className="flex items-center gap-3 rounded-lg border border-white/20 bg-surface px-4 py-3">
          {!isRecording && !recordedBlob && (
            <button
              type="button"
              onClick={handleStartRecording}
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/80"
              aria-label="Start recording"
            >
              <Mic className="size-5" />
            </button>
          )}

          {isRecording && (
            <>
              {isPaused ? (
                <button
                  type="button"
                  onClick={resume}
                  className="flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-transparent text-primary transition-colors hover:bg-primary/10"
                  aria-label="Resume recording"
                >
                  <Play className="size-5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={pause}
                  className="flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-transparent text-primary transition-colors hover:bg-primary/10"
                  aria-label="Pause recording"
                >
                  <Pause className="size-5" />
                </button>
              )}
            </>
          )}

          {recordedBlob && !isRecording && (
            <button
              type="button"
              onClick={handleStartRecording}
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/80"
              aria-label="Re-record"
            >
              <Mic className="size-5" />
            </button>
          )}

          {/* Timer */}
          <span className="min-w-[4ch] font-mono text-sm tabular-nums text-foreground">
            {isRecording ? formatTimer(durationMs) : recordedBlob ? formatTimer(recordedDuration) : "00:00"}
          </span>

          {/* Waveform bars */}
          <div className="flex flex-1 items-end gap-[2px]" style={{ height: 32 }}>
            {bars.map((h, i) => {
              const filled = isRecording
                ? i / BAR_COUNT <= durationMs / 60_000
                : recordedBlob
                  ? i / BAR_COUNT <= progress
                  : false;
              return (
                <div
                  key={i}
                  className={cn(
                    "flex-1 rounded-sm transition-all duration-100",
                    filled ? "bg-white" : "bg-white/20",
                    isRecording && !isPaused && filled ? "animate-pulse" : "",
                  )}
                  style={{ height: `${h * 100}%` }}
                />
              );
            })}
          </div>

          {/* Stop button */}
          {isRecording && (
            <button
              type="button"
              onClick={handleStopRecording}
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-destructive text-destructive-foreground transition-colors hover:brightness-110"
              aria-label="Stop recording"
            >
              <Stop className="size-4" />
            </button>
          )}
        </div>

        {/* Save button */}
        <Button
          variant="brand"
          size="lg"
          className="w-full"
          onClick={handleSave}
          disabled={isSaving || isRecording || !recordedBlob}
        >
          {isSaving ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save"
          )}
        </Button>
      </div>
    </AppModal>
  );
}
