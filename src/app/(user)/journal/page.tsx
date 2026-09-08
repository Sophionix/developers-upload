"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout";
import { AppModal } from "@/components/ui/app-modal";
import { Button } from "@/components/ui/button";
import { Calendar, Search, SlidersHorizontal } from "@/lib/ui/icons";
import { toast } from "@/components/ui/toast";
import { listJournalEntries, deleteJournalEntry } from "@/server/actions/journal";
import type { JournalEntryListItemDto } from "@/lib/dto/journal";
import { ACCENT_COLORS } from "@/lib/ui/constants";
import { cn } from "@/lib/ui/cn";

function formatDate(d: Date): string {
  const dt = new Date(d);
  return `${dt.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" })} | ${dt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`;
}

/** Figma 0:3569 — journal row typography (Roboto UI). */
const journalRowTypography = {
  fontFamily: "var(--font-roboto-ui), system-ui, sans-serif",
  fontVariationSettings: "'wdth' 100",
} as const;

function JournalEntrySkeleton() {
  return (
    <div className="flex min-h-[134px] overflow-hidden rounded-[21px] border border-[rgba(255,255,255,0.38)] bg-card shadow-elevated animate-pulse">
      <div className="w-[37px] shrink-0 rounded-bl-[21px] rounded-tl-[21px] bg-white/10" />
      <div className="flex min-w-0 flex-1 flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 md:px-5">
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:max-w-[min(100%,472px)]">
          <div className="h-6 w-40 rounded bg-white/10" />
          <div className="h-4 w-full rounded bg-white/10" />
          <div className="h-4 w-[92%] rounded bg-white/10 sm:hidden" />
        </div>
        <div className="h-5 w-44 shrink-0 rounded bg-white/10 sm:mx-auto" />
        <div className="flex shrink-0 gap-3">
          <div className="h-5 w-14 rounded bg-white/10" />
          <div className="h-5 w-10 rounded bg-white/10" />
          <div className="h-5 w-10 rounded bg-white/10" />
        </div>
      </div>
    </div>
  );
}

/** Split filter field into tag tokens (comma or semicolon separated). */
function parseTagTokens(raw: string): string[] {
  const parts = raw
    .split(/[,;]+/)
    .map((t) => t.trim().slice(0, 80))
    .filter(Boolean);
  return Array.from(new Set(parts)).slice(0, 20);
}

function JournalSearchFilterModal({
  initialTitle,
  initialTags,
  onApply,
  onClose,
}: {
  initialTitle: string;
  initialTags: string;
  onApply: (title: string, tagsRaw: string) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = React.useState(initialTitle);
  const [tags, setTags] = React.useState(initialTags);

  return (
    <AppModal title="Search Filter" onClose={onClose} className="border border-white/15 bg-zinc-950 shadow-2xl">
      <div className="flex flex-col gap-4">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter Title"
          className={cn(
            "w-full rounded-full border border-white/20 bg-zinc-900/90 px-5 py-3.5 text-sm text-foreground",
            "placeholder:text-muted-foreground focus:border-white/35 focus:outline-none",
          )}
        />
        <input
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="Enter Tags"
          className={cn(
            "w-full rounded-full border border-white/20 bg-zinc-900/90 px-5 py-3.5 text-sm text-foreground",
            "placeholder:text-muted-foreground focus:border-white/35 focus:outline-none",
          )}
        />
        <Button
          variant="brand"
          size="lg"
          className="w-full font-semibold"
          onClick={() => onApply(title.trim(), tags)}
        >
          Apply
        </Button>
      </div>
    </AppModal>
  );
}

export default function JournalPage() {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [entries, setEntries] = React.useState<JournalEntryListItemDto[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filterModalOpen, setFilterModalOpen] = React.useState(false);
  const [serverFilters, setServerFilters] = React.useState<{
    titleContains: string;
    tagTokens: string[];
  }>({ titleContains: "", tagTokens: [] });

  React.useEffect(() => {
    let cancelled = false;
    const title = serverFilters.titleContains.trim();
    const tokens = serverFilters.tagTokens;
    void listJournalEntries({
      take: 20,
      ...(title ? { titleContains: title } : {}),
      ...(tokens.length ? { tagTokens: tokens } : {}),
    })
      .then((res) => {
        if (!cancelled) setEntries(res.items);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [serverFilters]);

  const hasActiveListFilter =
    serverFilters.titleContains.trim().length > 0 || serverFilters.tagTokens.length > 0;

  const filteredEntries = search
    ? entries.filter((e) =>
      (e.title ?? "").toLowerCase().includes(search.toLowerCase()) ||
      e.snippet.toLowerCase().includes(search.toLowerCase()) ||
      e.tags.some((t) =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.slug.toLowerCase().includes(search.toLowerCase()),
      ),
    )
    : entries;

  const handleDelete = async (id: string) => {
    const prev = entries;
    setEntries((e) => e.filter((n) => n.id !== id));
    try {
      await deleteJournalEntry({ id });
      toast.success("Note deleted.");
    } catch {
      setEntries(prev);
      toast.error("Failed to delete note.");
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Journal Notes" className="pb-0" />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-full min-w-0 items-center gap-2 rounded-lg border border-white/10 bg-surface px-3 sm:w-80">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => setFilterModalOpen(true)}
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-surface text-muted-foreground transition-colors hover:bg-white/10",
              hasActiveListFilter && "border-primary/50 text-primary",
            )}
            aria-label="Filter by title and tags"
          >
            <SlidersHorizontal className="size-4" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-btn-danger text-white transition-opacity hover:opacity-90"
          >
            <Calendar className="size-5" />
          </button>
          <Link
            href="/journal/create"
            className="flex h-10 flex-1 items-center justify-center rounded-lg bg-btn-danger px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90 sm:flex-none"
          >
            Create Note
          </Link>
        </div>
      </div>

      {hasActiveListFilter ? (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>Showing entries filtered by title and/or tags.</span>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setServerFilters({ titleContains: "", tagTokens: [] });
            }}
            className="text-primary underline underline-offset-2"
          >
            Clear filters
          </button>
        </div>
      ) : null}

      <div className="w-full">
        {loading ? (
          <div className="flex flex-col gap-4 py-2">
            {Array.from({ length: 3 }, (_, i) => (
              <JournalEntrySkeleton key={i} />
            ))}
          </div>
        ) : filteredEntries.length === 0 ? (
          <p
            className="rounded-[21px] border border-[rgba(255,255,255,0.38)] bg-card py-16 text-center text-lg text-muted-foreground shadow-elevated"
            style={journalRowTypography}
          >
            {search
              ? "No matching entries."
              : hasActiveListFilter
                ? "No entries match your filters."
                : "No journal entries yet."}
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {filteredEntries.map((entry, i) => {
              const accent = ACCENT_COLORS[i % ACCENT_COLORS.length];
              return (
                <article
                  key={entry.id}
                  className="flex min-h-[134px] overflow-hidden rounded-[21px] border border-[rgba(255,255,255,0.38)] bg-card shadow-elevated"
                >
                  <div
                    className="w-[37px] shrink-0 rounded-bl-[21px] rounded-tl-[21px] shadow-[0_4px_34px_0px_rgba(0,0,0,0.15)]"
                    style={{ backgroundColor: accent }}
                    aria-hidden
                  />
                  <div className="flex w-full min-w-0 flex-1 flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 md:px-5">
                    <div className="flex min-h-[61px] min-w-0 flex-1 flex-col justify-center gap-1 sm:max-w-[min(100%,472px)]">
                      <h3
                        className="text-xl font-bold leading-tight text-foreground"
                        style={journalRowTypography}
                      >
                        {entry.title ?? "Untitled"}
                      </h3>
                      <p
                        className="line-clamp-2 text-lg font-light leading-[29px] text-foreground"
                        style={journalRowTypography}
                      >
                        {entry.snippet}
                      </p>
                    </div>
                    <p
                      className="shrink-0 text-center text-xl font-medium leading-tight text-foreground sm:px-2"
                      style={journalRowTypography}
                    >
                      {formatDate(entry.createdAt)}
                    </p>
                    <div
                      className="flex shrink-0 flex-wrap items-center justify-center gap-x-4 gap-y-1 sm:justify-end"
                      style={journalRowTypography}
                    >
                      <button
                        type="button"
                        onClick={() => handleDelete(entry.id)}
                        className="cursor-pointer text-xl font-bold text-foreground underline decoration-solid underline-offset-[0.2em] transition-opacity hover:opacity-90"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => router.push(`/journal/${entry.id}/edit`)}
                        className="cursor-pointer text-xl font-bold text-foreground underline decoration-solid underline-offset-[0.2em] transition-opacity hover:opacity-90"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => router.push(`/journal/${entry.id}`)}
                        className="cursor-pointer text-xl font-bold text-foreground underline decoration-solid underline-offset-[0.2em] transition-opacity hover:opacity-90"
                      >
                        View
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {filterModalOpen ? (
        <JournalSearchFilterModal
          initialTitle={serverFilters.titleContains}
          initialTags={serverFilters.tagTokens.join(", ")}
          onClose={() => setFilterModalOpen(false)}
          onApply={(title, tagsRaw) => {
            setLoading(true);
            setServerFilters({
              titleContains: title,
              tagTokens: parseTagTokens(tagsRaw),
            });
            setFilterModalOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
