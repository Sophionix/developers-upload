"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, Trash2, Loader2, AlertCircle } from "@/lib/ui/icons";
import { cn } from "@/lib/ui/cn";

type ImageUploaderProps = {
  value: string | null;
  onChange: (url: string | null) => void;
  kind: "card" | "deck" | "journey";
  className?: string;
  disabled?: boolean;
};

const ACCEPT = "image/png,image/jpeg,image/webp";
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB — matches UPLOAD_MAX_CARD_ART_BYTES

type UploadState =
  | { status: "idle" }
  | { status: "uploading" }
  | { status: "error"; message: string };

export function ImageUploader({
  value,
  onChange,
  kind,
  className,
  disabled,
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [state, setState] = useState<UploadState>({ status: "idle" });
  const [preview, setPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const displayUrl = preview ?? value;

  const upload = useCallback(
    async (file: File) => {
      if (!file.type.match(/^image\/(png|jpeg|webp)$/)) {
        setState({ status: "error", message: "Only PNG, JPG, or WebP allowed." });
        return;
      }
      if (file.size > MAX_BYTES) {
        setState({ status: "error", message: "File exceeds 8 MB limit." });
        return;
      }

      const localPreview = URL.createObjectURL(file);
      setPreview(localPreview);
      setState({ status: "uploading" });

      try {
        const res = await fetch("/api/admin/content/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contentType: file.type,
            sizeBytes: file.size,
            kind,
          }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => null) as Record<string, unknown> | null;
          throw new Error((body?.code as string) ?? `Upload URL request failed (${res.status})`);
        }

        const { url, headers, publicUrl } = (await res.json()) as {
          url: string;
          headers: Record<string, string>;
          publicUrl: string;
        };

        const putRes = await fetch(url, {
          method: "PUT",
          headers: { "Content-Type": file.type, ...headers },
          body: file,
        });

        if (!putRes.ok) throw new Error("File upload failed.");

        onChange(publicUrl);
        setState({ status: "idle" });
      } catch (err) {
        setState({
          status: "error",
          message: err instanceof Error ? err.message : "Upload failed.",
        });
        setPreview(null);
      }
    },
    [kind, onChange],
  );

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) upload(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) upload(file);
  };

  const handleRemove = () => {
    setPreview(null);
    onChange(null);
    setState({ status: "idle" });
  };

  const isUploading = state.status === "uploading";

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {displayUrl ? (
        <div className="relative overflow-hidden rounded-md border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={displayUrl}
            alt=""
            className={cn(
              "h-32 w-full object-cover",
              isUploading && "opacity-50",
            )}
          />
          {isUploading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="absolute right-1.5 top-1.5 flex gap-1">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={disabled}
                className="rounded bg-black/60 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/80 disabled:opacity-50"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={handleRemove}
                disabled={disabled}
                className="rounded bg-black/60 p-1 text-white backdrop-blur-sm transition-colors hover:bg-destructive disabled:opacity-50"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          disabled={disabled || isUploading}
          className={cn(
            "flex h-28 flex-col items-center justify-center gap-1.5 rounded-md border-2 border-dashed border-border text-sm text-muted-foreground transition-colors",
            "hover:border-primary/50 hover:text-foreground",
            "disabled:pointer-events-none disabled:opacity-50",
            dragOver && "border-primary bg-primary/5",
          )}
        >
          {isUploading ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <Upload className="size-5" />
          )}
          <span>{isUploading ? "Uploading..." : "Click or drop image"}</span>
          <span className="text-xs">PNG, JPG, WebP up to 8 MB</span>
        </button>
      )}

      {state.status === "error" ? (
        <p className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle className="size-3.5 shrink-0" />
          {state.message}
        </p>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        onChange={handleFile}
        className="hidden"
        aria-label={`Upload ${kind} image`}
      />
    </div>
  );
}
