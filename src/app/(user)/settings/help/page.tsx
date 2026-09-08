"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { Loader2, Plus, X } from "@/lib/ui/icons";
import { PageHeader } from "@/components/layout";
import { toast } from "@/components/ui/toast";
import { submitFeedback } from "@/server/actions/settings";

export default function HelpFeedbackPage() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  function handleAddPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;

    const newPhotos = Array.from(files).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setPhotos((prev) => [...prev, ...newPhotos]);

    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleRemovePhoto(index: number) {
    setPhotos((prev) => {
      const target = prev[index];
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter((_, i) => i !== index);
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Please enter a title.");
      return;
    }
    if (!message.trim()) {
      toast.error("Please enter a message.");
      return;
    }
    startTransition(async () => {
      try {
        await submitFeedback({
          title: title.trim(),
          message: message.trim(),
        });
        toast.success("Feedback submitted. Thank you!");
        setTitle("");
        setMessage("");
        photos.forEach((p) => URL.revokeObjectURL(p.preview));
        setPhotos([]);
      } catch {
        toast.error("Failed to submit feedback.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Help & Feedback" backHref="/settings" className="pb-0" />

      <form onSubmit={handleSubmit} className="flex w-full flex-col gap-5 lg:w-[60%]">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter Title.."
          className="w-full rounded-xl border border-white/20 bg-surface px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-white/40"
        />

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Write here..."
          rows={6}
          className="w-full resize-none rounded-xl border border-white/20 bg-surface px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-white/40"
        />

        <div className="flex flex-wrap items-start gap-3">
          {photos.map((photo, i) => (
            <div key={photo.preview} className="relative size-24 shrink-0">
              <Image
                src={photo.preview}
                alt={`Attachment ${i + 1}`}
                fill
                className="rounded-xl object-cover"
              />
              <button
                type="button"
                onClick={() => handleRemovePhoto(i)}
                className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-muted-foreground text-black"
                aria-label={`Remove photo ${i + 1}`}
              >
                <X className="size-3" />
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex size-24 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-white/30 text-muted-foreground transition-colors hover:border-white/50 hover:text-foreground"
          >
            <Plus className="size-5" />
            <span className="text-xs">Add Photos</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleAddPhotos}
            className="hidden"
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="flex w-full items-center justify-center gap-2 rounded-pill bg-btn-brand py-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          Submit
        </button>
      </form>
    </div>
  );
}
