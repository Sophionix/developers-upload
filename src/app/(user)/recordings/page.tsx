"use client";

import * as React from "react";
import { AudioPlayer } from "@/components/features/audio-player";
import { NewRecordingModal } from "@/components/features/new-recording-modal";
import { DatePickerModal } from "@/components/features/date-picker-modal";
import { DeleteRecordingModal } from "@/components/features/delete-recording-modal";
import { Mic, Calendar } from "@/lib/ui/icons";
import {
  listJournalEntries,
  getJournalEntry,
} from "@/server/actions/journal";
import { deleteVoiceNote } from "@/server/actions/voice-notes";
import type { JournalEntryDto, JournalVoiceNoteDto } from "@/lib/dto/journal";

interface RecordingItem {
  voiceNoteId: string;
  entryId: string;
  title: string;
  createdAt: Date;
  storagePath: string;
  durationMs: number;
  mimeType: string;
}

function getStreamUrl(storagePath: string): string {
  return `/api/journal/voice-notes/stream?path=${encodeURIComponent(storagePath)}`;
}

function formatRecordingDate(date: Date): string {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, "0");
  const month = d.toLocaleDateString("en-US", { month: "short" });
  const year = d.getFullYear();
  const hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  const h12 = hours % 12 || 12;
  return `${day}-${month}-${year}  | ${h12}:${minutes}${ampm}`;
}

function toDateKey(d: Date): string {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

function SkeletonCard() {
  return (
    <div
      className="rounded-[16px] border border-white/[0.38] px-4 py-3 sm:rounded-[21px] sm:px-6 sm:py-4"
      style={{ background: "rgba(26, 1, 1, 0.58)", boxShadow: "0px 4px 34px 0px rgba(0,0,0,0.15)" }}
    >
      <div className="mb-2 h-4 w-32 animate-pulse rounded bg-white/10 sm:mb-3" />
      <div className="flex items-center gap-3">
        <div className="size-10 animate-pulse rounded-full bg-white/10 sm:size-12" />
        <div className="flex-1 animate-pulse rounded bg-white/10" style={{ height: 48 }} />
        <div className="hidden h-4 w-36 animate-pulse rounded bg-white/10 sm:block" />
        <div className="h-4 w-12 animate-pulse rounded bg-white/10" />
      </div>
    </div>
  );
}

export default function RecordingsPage() {
  const [recordings, setRecordings] = React.useState<RecordingItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [showNewModal, setShowNewModal] = React.useState(false);
  const [showDateModal, setShowDateModal] = React.useState(false);
  const [filterDate, setFilterDate] = React.useState<Date | null>(null);
  const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(null);

  const loadRecordings = React.useCallback(async () => {
    try {
      const { items } = await listJournalEntries({ take: 50 });

      const fullEntries = await Promise.all(
        items.map((item) =>
          getJournalEntry({ id: item.id }).catch(() => null),
        ),
      );

      const withNotes = fullEntries.filter(
        (e): e is JournalEntryDto =>
          e !== null && e.voiceNotes.length > 0,
      );

      const allRecordings: RecordingItem[] = [];

      for (const entry of withNotes) {
        for (const vn of entry.voiceNotes as JournalVoiceNoteDto[]) {
          allRecordings.push({
            voiceNoteId: vn.id,
            entryId: entry.id,
            title: entry.title || "Untitled Recording",
            createdAt: vn.createdAt,
            storagePath: vn.storagePath,
            durationMs: vn.durationMs,
            mimeType: vn.mimeType,
          });
        }
      }

      allRecordings.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

      setRecordings(allRecordings);
    } catch {
      // Empty state will show
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadRecordings(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [loadRecordings]);

  const datesWithRecordings = React.useMemo(() => {
    const set = new Set<string>();
    for (const r of recordings) {
      set.add(toDateKey(r.createdAt));
    }
    return set;
  }, [recordings]);

  const filteredRecordings = React.useMemo(() => {
    if (!filterDate) return recordings;
    const key = toDateKey(filterDate);
    return recordings.filter((r) => toDateKey(r.createdAt) === key);
  }, [recordings, filterDate]);

  async function handleDelete(voiceNoteId: string) {
    setRecordings((prev) => prev.filter((r) => r.voiceNoteId !== voiceNoteId));

    try {
      await deleteVoiceNote({ id: voiceNoteId });
    } catch {
      window.location.reload();
    }
  }

  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold leading-normal text-white sm:text-3xl">
          My Recordings
        </h1>
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => setShowDateModal(true)}
            className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/80 sm:size-11"
            aria-label="Filter by date"
          >
            <Calendar className="size-4 sm:size-5" />
          </button>
          <button
            type="button"
            onClick={() => setShowNewModal(true)}
            className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/80 sm:size-11"
            aria-label="New voice recording"
          >
            <Mic className="size-4 sm:size-5" />
          </button>
        </div>
      </div>

      {/* Active filter indicator */}
      {filterDate && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            Showing recordings from{" "}
            <span className="font-medium text-foreground">
              {filterDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </span>
          </span>
          <button
            type="button"
            onClick={() => setFilterDate(null)}
            className="text-primary underline underline-offset-2"
          >
            Clear
          </button>
        </div>
      )}

      {/* Table header */}
      <div className="flex items-center rounded-full px-5 py-2.5 text-sm font-bold text-white sm:px-6 sm:py-3 sm:text-base" style={{ background: "#B44F00" }}>
        <span className="flex-1">Recordings</span>
        <span className="hidden sm:block sm:w-40 sm:text-center">Created Date/Time</span>
        <span className="w-12 text-right sm:w-14 sm:text-center">Action</span>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex flex-col gap-2.5 sm:gap-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && filteredRecordings.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Mic className="mb-3 size-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            {filterDate ? "No recordings on this date" : "No voice recordings yet"}
          </p>
          {!filterDate && (
            <button
              type="button"
              onClick={() => setShowNewModal(true)}
              className="mt-4 text-sm font-medium text-primary underline underline-offset-2"
            >
              Create your first recording
            </button>
          )}
        </div>
      )}

      {/* Recording cards */}
      {!isLoading && (
        <div className="flex flex-col gap-2.5 sm:gap-3">
          {filteredRecordings.map((rec) => (
            <AudioPlayer
              key={rec.voiceNoteId}
              src={getStreamUrl(rec.storagePath)}
              durationMs={rec.durationMs}
              mimeType={rec.mimeType}
              title={rec.title}
              dateLabel={formatRecordingDate(rec.createdAt)}
              onDelete={() => setDeleteTargetId(rec.voiceNoteId)}
            />
          ))}
        </div>
      )}

      {showNewModal && (
        <NewRecordingModal
          onClose={() => setShowNewModal(false)}
          onSaved={() => {
            setShowNewModal(false);
            setIsLoading(true);
            void loadRecordings();
          }}
        />
      )}

      {deleteTargetId && (
        <DeleteRecordingModal
          onClose={() => setDeleteTargetId(null)}
          onConfirm={async () => {
            await handleDelete(deleteTargetId);
            setDeleteTargetId(null);
          }}
        />
      )}

      {showDateModal && (
        <DatePickerModal
          selectedDate={filterDate}
          datesWithRecordings={datesWithRecordings}
          onClose={() => setShowDateModal(false)}
          onDone={(date) => {
            setFilterDate(date);
            setShowDateModal(false);
          }}
        />
      )}
    </div>
  );
}
