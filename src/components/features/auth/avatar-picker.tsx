"use client";

import * as React from "react";
import Image from "next/image";
import { Camera, User } from "@/lib/ui/icons";
import { cn } from "@/lib/ui/cn";

type AvatarPickerProps = {
  value: string | null;
  onChange: (file: File, preview: string) => void;
  className?: string;
};

export function AvatarPicker({ value, onChange, className }: AvatarPickerProps) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    onChange(file, preview);
  };

  return (
    <div className={cn("flex justify-center", className)}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="group relative size-20 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <div className="size-full overflow-hidden rounded-full border-2 border-primary bg-muted">
          {value ? (
            <Image
              src={value}
              alt="Profile photo"
              width={80}
              height={80}
              className="size-full object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center">
              <User className="size-8 text-muted-foreground" />
            </div>
          )}
        </div>
        <span className="absolute -bottom-0.5 -right-0.5 grid size-7 place-items-center rounded-full bg-primary text-white shadow-elevated">
          <Camera className="size-3.5" />
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
        aria-label="Upload profile photo"
      />
    </div>
  );
}
