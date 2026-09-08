"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/layout";
import { AudioPlayer } from "@/components/features/audio-player";
import { Clock, Pencil, Tag } from "@/lib/ui/icons";
import { getJournalEntry } from "@/server/actions/journal";
import { getCard } from "@/server/actions/content";
import type { JournalEntryDto } from "@/lib/dto/journal";
import type { CardDetailDto } from "@/lib/dto/card";
import { JournalReflectionCard } from "@/components/features/journal/journal-reflection-card";

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function JournalViewPage() {
  const { id } = useParams<{ id: string }>();
  const [entry, setEntry] = useState<JournalEntryDto | null>(null);
  const [card, setCard] = useState<CardDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    getJournalEntry({ id })
      .then((e) => {
        setEntry(e);
        if (e.cardId) {
          // Load the card saved with this entry so it shows alongside the note.
          getCard({ id: e.cardId })
            .then(setCard)
            .catch(() => {
              // card removed or no longer accessible — show the note without it
            });
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-white/5" />
        <div className="flex w-full flex-col gap-4 lg:w-[60%]">
          <div className="h-10 w-full animate-pulse rounded-xl bg-white/5" />
          <div className="h-48 w-full animate-pulse rounded-xl bg-white/5" />
        </div>
      </div>
    );
  }

  if (error || !entry) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Journal" backHref="/journal" className="pb-0" />
        <p className="text-sm text-muted-foreground">Entry not found.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={entry.title ?? "Untitled"}
        backHref="/journal"
        className="pb-0"
      />

      <div className="flex w-full flex-col gap-5 lg:w-[60%]">
        {/* Meta info */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Clock className="size-3.5" />
            {formatDate(entry.createdAt)}
          </span>
          {entry.updatedAt > entry.createdAt ? (
            <span className="flex items-center gap-1.5">
              Updated {formatDate(entry.updatedAt)}
            </span>
          ) : null}
          {entry.isDraft ? (
            <span className="rounded-full bg-yellow-500/20 px-2 py-0.5 text-yellow-400">
              Draft
            </span>
          ) : null}
        </div>

        {/* Tags */}
        {entry.tags.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <Tag className="size-3.5 text-muted-foreground" />
            {entry.tags.map((tag) => (
              <span
                key={tag.id}
                className="rounded-full border border-white/20 bg-surface px-3 py-1 text-xs text-foreground"
              >
                {tag.name}
              </span>
            ))}
          </div>
        ) : null}

        {/* Saved card */}
        {card ? <JournalReflectionCard card={card} /> : null}

        {/* Body */}
        <div
          className="prose prose-invert max-w-none text-sm leading-relaxed text-foreground"
          dangerouslySetInnerHTML={{ __html: entry.bodyHtml }}
        />

        {/* Voice notes */}
        {entry.voiceNotes.length > 0 ? (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted-foreground">Voice Notes</span>
            {entry.voiceNotes.map((vn) => (
              <AudioPlayer
                key={vn.id}
                src=""
                durationMs={vn.durationMs}
                mimeType={vn.mimeType}
                compact
              />
            ))}
          </div>
        ) : null}

        {/* Edit button */}
        <Link
          href={`/journal/${entry.id}/edit`}
          className="flex w-full items-center justify-center gap-2 rounded-pill bg-btn-brand py-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          <Pencil className="size-4" />
          Edit Note
        </Link>
      </div>
    </div>
  );
}
