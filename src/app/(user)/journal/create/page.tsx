"use client";

import { useState, useTransition, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, X } from "@/lib/ui/icons";
import { PageHeader } from "@/components/layout";
import { toast } from "@/components/ui/toast";
import { createJournalEntry } from "@/server/actions/journal";
import { getCard } from "@/server/actions/content";
import type { CardDetailDto } from "@/lib/dto/card";
import { JournalReflectionCard } from "@/components/features/journal/journal-reflection-card";
import {
  JournalNoteEditor,
  JOURNAL_EDITOR_EMPTY_HTML,
  journalEditorIsEffectivelyEmpty,
  type JournalEditorFont,
} from "@/components/features/journal/journal-note-editor";

export default function CreateNotePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cardId = searchParams.get("cardId");

  const [title, setTitle] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [font, setFont] = useState<JournalEditorFont>("Sans Serif");
  const [pending, startTransition] = useTransition();

  const [card, setCard] = useState<CardDetailDto | null>(null);
  const [cardLoading, setCardLoading] = useState<boolean>(Boolean(cardId));

  // Load the card the reader came from, if any, so it can be shown and saved
  // together with the note.
  useEffect(() => {
    if (!cardId) return;
    let active = true;
    getCard({ id: cardId })
      .then((detail) => {
        if (active) setCard(detail);
      })
      .catch(() => {
        // entitlement or not found — fall back to a plain note
      })
      .finally(() => {
        if (active) setCardLoading(false);
      });
    return () => {
      active = false;
    };
  }, [cardId]);

  const handleBodyChange = useCallback((html: string) => {
    setBodyHtml(html);
  }, []);

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault();
      setTags((prev) => [...prev, tagInput.trim()]);
      setTagInput("");
    }
  }

  function handleRemoveTag(index: number) {
    setTags((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (journalEditorIsEffectivelyEmpty(bodyHtml)) {
      toast.error("Please enter a note.");
      return;
    }
    startTransition(async () => {
      try {
        await createJournalEntry({
          title: title.trim() || undefined,
          bodyHtml,
          tags,
          cardId: card?.id,
        });
        toast.success(card ? "Card saved to your journal." : "Note created.");
        router.push("/journal");
      } catch {
        toast.error("Failed to create note.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={card || cardLoading ? "Journal Your Card" : "Create Note"}
        backHref="/journal"
        className="pb-0"
      />

      <form onSubmit={handleSubmit} className="flex w-full flex-col gap-5 lg:w-[60%]">
        {cardLoading ? (
          <div className="flex items-center gap-2 rounded-2xl border border-white/15 bg-surface p-4 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading your card…
          </div>
        ) : card ? (
          <JournalReflectionCard card={card} />
        ) : null}

        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter Title.."
          className="w-full rounded-xl border border-white/20 bg-surface px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-white/40"
        />

        <JournalNoteEditor
          defaultHtml={JOURNAL_EDITOR_EMPTY_HTML}
          onChange={handleBodyChange}
          font={font}
          onFontChange={setFont}
          betweenEditorAndToolbar={
            <>
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder="Tags"
                className="w-full rounded-xl border border-white/20 bg-surface px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-white/40"
              />

              {tags.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                  {tags.map((tag, i) => (
                    <span
                      key={`${tag}-${i}`}
                      className="flex items-center gap-1.5 rounded-full border border-white/20 bg-surface px-3 py-1.5 text-xs text-foreground"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(i)}
                        className="text-muted-foreground transition-colors hover:text-foreground"
                        aria-label={`Remove tag ${tag}`}
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
            </>
          }
        />

        <button
          type="submit"
          disabled={pending}
          className="flex w-full items-center justify-center gap-2 rounded-pill bg-btn-brand py-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          Save
        </button>
      </form>
    </div>
  );
}
