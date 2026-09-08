"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, X } from "@/lib/ui/icons";
import { PageHeader } from "@/components/layout";
import { toast } from "@/components/ui/toast";
import { getJournalEntry, updateJournalEntry } from "@/server/actions/journal";
import type { JournalEntryDto } from "@/lib/dto/journal";
import {
  JournalNoteEditor,
  JOURNAL_EDITOR_EMPTY_HTML,
  journalEditorIsEffectivelyEmpty,
  type JournalEditorFont,
} from "@/components/features/journal/journal-note-editor";

export default function EditNotePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [entry, setEntry] = useState<JournalEntryDto | null>(null);
  const [bodyHtml, setBodyHtml] = useState("");
  const [title, setTitle] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [font, setFont] = useState<JournalEditorFont>("Sans Serif");
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const handleBodyChange = useCallback((html: string) => {
    setBodyHtml(html);
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setLoading(true);
    setError(false);
    setEntry(null);
    getJournalEntry({ id })
      .then((e) => {
        setEntry(e);
        setTitle(e.title ?? "");
        setTags(e.tags.map((t) => t.name));
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);
  /* eslint-enable react-hooks/set-state-in-effect */

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
        await updateJournalEntry({
          id,
          title: title.trim() || undefined,
          bodyHtml,
          tags,
          isDraft: false,
        });
        toast.success("Note updated.");
        router.push(`/journal/${id}`);
      } catch {
        toast.error("Failed to update note.");
      }
    });
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-white/5" />
        <div className="flex w-full flex-col gap-4 lg:w-[60%]">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-12 w-full animate-pulse rounded-xl bg-white/5" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !entry) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Edit Note" backHref="/journal" className="pb-0" />
        <p className="text-sm text-muted-foreground">Entry not found.</p>
      </div>
    );
  }

  const seedHtml = entry.bodyHtml?.trim() ? entry.bodyHtml : JOURNAL_EDITOR_EMPTY_HTML;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Edit Note" backHref={`/journal/${id}`} className="pb-0" />

      <form onSubmit={handleSubmit} className="flex w-full flex-col gap-5 lg:w-[60%]">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter Title.."
          className="w-full rounded-xl border border-white/20 bg-surface px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-white/40"
        />

        <JournalNoteEditor
          key={entry.id}
          defaultHtml={seedHtml}
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
                        className="cursor-pointer text-muted-foreground transition-colors hover:text-foreground"
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
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-pill bg-btn-brand py-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          Save Changes
        </button>
      </form>
    </div>
  );
}
