"use client";

import * as React from "react";
import { cn } from "@/lib/ui/cn";

type OtpInputProps = {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  autoFocus?: boolean;
  disabled?: boolean;
  className?: string;
  name?: string;
};

/**
 * 6-digit (default) OTP entry. Backs onto a single hidden string; renders N cells.
 * Auto-advances, handles paste, and supports backspace-to-prev.
 */
export function OtpInput({
  value,
  onChange,
  length = 6,
  autoFocus,
  disabled,
  className,
  name,
}: OtpInputProps) {
  const refs = React.useRef<(HTMLInputElement | null)[]>([]);
  const chars = React.useMemo(() => {
    const padded = value.slice(0, length).padEnd(length, " ");
    return padded.split("");
  }, [value, length]);

  React.useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  const focusCell = (i: number) => {
    const clamped = Math.max(0, Math.min(length - 1, i));
    refs.current[clamped]?.focus();
    refs.current[clamped]?.select();
  };

  const writeAt = (i: number, char: string) => {
    const next = (value.padEnd(length, " ").slice(0, i) + char + value.padEnd(length, " ").slice(i + 1))
      .replace(/\s+$/, "")
      .slice(0, length);
    onChange(next);
  };

  const handleChange = (i: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const digit = e.target.value.replace(/\D/g, "").slice(-1);
    if (!digit) {
      writeAt(i, " ");
      return;
    }
    writeAt(i, digit);
    if (i < length - 1) focusCell(i + 1);
  };

  const handleKeyDown = (i: number) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (!chars[i] || chars[i] === " ") {
        focusCell(i - 1);
        writeAt(i - 1, " ");
        e.preventDefault();
      }
    } else if (e.key === "ArrowLeft") {
      focusCell(i - 1);
      e.preventDefault();
    } else if (e.key === "ArrowRight") {
      focusCell(i + 1);
      e.preventDefault();
    }
  };

  const handlePaste = (i: number) => (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length - i);
    if (!pasted) return;
    e.preventDefault();
    const head = value.slice(0, i);
    const tail = value.slice(i + pasted.length);
    onChange((head + pasted + tail).slice(0, length));
    focusCell(Math.min(length - 1, i + pasted.length));
  };

  return (
    <div className={cn("flex items-center justify-center gap-1.5 sm:gap-3", className)} role="group" aria-label="One-time code">
      {chars.map((char, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          value={char.trim()}
          onChange={handleChange(i)}
          onKeyDown={handleKeyDown(i)}
          onPaste={handlePaste(i)}
          disabled={disabled}
          {...(name && i === 0 ? { name } : {})}
          className={cn(
            "size-10 shrink-0 rounded-full border border-white/20 bg-white/5 text-center font-mono text-lg text-foreground sm:size-12",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            "disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
          )}
        />
      ))}
    </div>
  );
}
