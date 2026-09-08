"use client";

import * as React from "react";
import { Play, Pause, Loader2 } from "@/lib/ui/icons";
import { cn } from "@/lib/ui/cn";

interface AudioPlayerProps {
  src: string;
  durationMs: number;
  mimeType?: string;
  onDelete?: () => void;
  onSave?: () => void;
  compact?: boolean;
  /** Show title + date in a card layout matching the recordings page design */
  title?: string;
  dateLabel?: string;
}

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const BAR_COUNT = 48;

function generateBars(seed: number): number[] {
  const bars: number[] = [];
  let x = seed;
  for (let i = 0; i < BAR_COUNT; i++) {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    const base = 0.15 + (x % 100) / 100 * 0.85;
    bars.push(base);
  }
  return bars;
}

export function AudioPlayer({
  src,
  durationMs,
  mimeType,
  onDelete,
  onSave: _onSave,
  compact,
  title,
  dateLabel,
}: AudioPlayerProps) {
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const waveformRef = React.useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [currentMs, setCurrentMs] = React.useState(0);
  const [bars] = React.useState(() => generateBars(src.length));

  const totalMs = durationMs || 1;
  const progress = Math.min(currentMs / totalMs, 1);

  React.useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    function handleTimeUpdate() {
      setCurrentMs((audio!.currentTime ?? 0) * 1000);
    }
    function handleEnded() {
      setIsPlaying(false);
      setCurrentMs(0);
    }
    function handleCanPlay() {
      setIsLoading(false);
    }
    function handleWaiting() {
      setIsLoading(true);
    }

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("canplay", handleCanPlay);
    audio.addEventListener("waiting", handleWaiting);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("canplay", handleCanPlay);
      audio.removeEventListener("waiting", handleWaiting);
    };
  }, []);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      setIsLoading(true);
      audio.play().then(
        () => {
          setIsPlaying(true);
          setIsLoading(false);
        },
        () => setIsLoading(false),
      );
    }
  }

  function handleSeek(e: React.MouseEvent<HTMLDivElement>) {
    const audio = audioRef.current;
    const bar = waveformRef.current;
    if (!audio || !bar) return;

    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const seekTime = (ratio * totalMs) / 1000;
    audio.currentTime = seekTime;
    setCurrentMs(ratio * totalMs);
  }

  const PlayIcon = isLoading ? Loader2 : isPlaying ? Pause : Play;

  if (title !== undefined) {
    return (
      <div
        className="rounded-[16px] border border-white/[0.38] px-4 py-3 sm:rounded-[21px] sm:px-6 sm:py-4"
        style={{
          background: "rgba(26, 1, 1, 0.58)",
          boxShadow: "0px 4px 34px 0px rgba(0,0,0,0.15)",
        }}
      >
        <audio ref={audioRef} src={src} preload="metadata">
          {mimeType && <source src={src} type={mimeType} />}
        </audio>

        {/* Title */}
        <p className="mb-2 text-sm font-bold leading-normal text-white sm:mb-3 sm:text-base">{title}</p>

        {/* Row: play btn + waveform + date + delete */}
        <div className="flex items-center gap-3">
          {/* Play / Pause button */}
          <button
            type="button"
            onClick={togglePlay}
            aria-label={isPlaying ? "Pause" : "Play"}
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/80 sm:size-12"
          >
            <PlayIcon className={cn("size-5", isLoading && "animate-spin")} />
          </button>

          {/* Waveform */}
          <div
            ref={waveformRef}
            className="flex flex-1 cursor-pointer items-center gap-[2px]"
            style={{ height: 48 }}
            onClick={handleSeek}
            role="slider"
            aria-valuenow={currentMs}
            aria-valuemin={0}
            aria-valuemax={totalMs}
            tabIndex={0}
          >
            {bars.map((h, i) => {
              const filled = i / BAR_COUNT <= progress;
              return (
                <div
                  key={i}
                  className={cn(
                    "flex-1 rounded-sm transition-colors duration-75",
                    filled ? "bg-white" : "bg-white/30",
                  )}
                  style={{ height: `${h * 100}%` }}
                />
              );
            })}
          </div>

          {/* Date label */}
          {dateLabel && (
            <span className="hidden shrink-0 text-right text-xs font-medium text-white/80 sm:block sm:w-40 sm:text-sm">
              {dateLabel.replace(/\s+/g, " ").trim()}
            </span>
          )}

          {/* Delete */}
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="shrink-0 text-sm font-bold text-white underline underline-offset-2 transition-colors hover:text-destructive"
            >
              Delete
            </button>
          )}
        </div>

        {/* Date on mobile — shown below the row */}
        {dateLabel && (
          <p className="mt-1.5 text-xs text-white/60 sm:hidden">
            {dateLabel.replace(/\s+/g, " ").trim()}
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border border-white/10 bg-surface",
        compact ? "px-3 py-2" : "px-4 py-3",
      )}
    >
      <audio ref={audioRef} src={src} preload="metadata">
        {mimeType && <source src={src} type={mimeType} />}
      </audio>

      <button
        type="button"
        onClick={togglePlay}
        aria-label={isPlaying ? "Pause" : "Play"}
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/80"
      >
        <PlayIcon className={cn("size-4", isLoading && "animate-spin")} />
      </button>

      <div
        ref={waveformRef}
        className="flex flex-1 cursor-pointer items-end gap-[2px]"
        style={{ height: 28 }}
        onClick={handleSeek}
        role="slider"
        aria-valuenow={currentMs}
        aria-valuemin={0}
        aria-valuemax={totalMs}
        tabIndex={0}
      >
        {bars.map((h, i) => {
          const filled = i / BAR_COUNT <= progress;
          return (
            <div
              key={i}
              className={cn(
                "flex-1 rounded-sm transition-colors duration-75",
                filled ? "bg-white" : "bg-white/30",
              )}
              style={{ height: `${h * 100}%` }}
            />
          );
        })}
      </div>

      <span className={cn("shrink-0 tabular-nums text-muted-foreground", compact ? "text-[11px]" : "text-xs")}>
        {formatTime(currentMs)} / {formatTime(totalMs)}
      </span>

      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="shrink-0 text-sm text-muted-foreground underline underline-offset-2 transition-colors hover:text-destructive"
        >
          Delete
        </button>
      )}
    </div>
  );
}
