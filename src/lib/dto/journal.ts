import type { Mood } from "@/generated/prisma/client";

export interface JournalTagDto {
  id: string;
  slug: string;
  name: string;
}

export interface JournalVoiceNoteDto {
  id: string;
  storagePath: string;
  durationMs: number;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
}

export interface JournalEntryListItemDto {
  id: string;
  title: string | null;
  snippet: string;
  cardId: string | null;
  moodCheckInId: string | null;
  isDraft: boolean;
  createdAt: Date;
  updatedAt: Date;
  tags: JournalTagDto[];
}

export interface JournalEntryDto {
  id: string;
  title: string | null;
  bodyHtml: string;
  bodyPlain: string;
  cardId: string | null;
  drawId: string | null;
  moodCheckInId: string | null;
  isDraft: boolean;
  createdAt: Date;
  updatedAt: Date;
  tags: JournalTagDto[];
  voiceNotes: JournalVoiceNoteDto[];
}

export interface JournalListPageDto {
  items: JournalEntryListItemDto[];
  nextCursor: string | null;
}

export interface JournalCalendarDayDto {
  date: string;
  count: number;
}

export interface JournalSearchHitDto {
  id: string;
  title: string | null;
  snippet: string;
  createdAt: Date;
}

export interface JournalSearchPageDto {
  items: JournalSearchHitDto[];
  nextCursor: string | null;
}

export interface TagSuggestionDto {
  id: string;
  slug: string;
  name: string;
}

export type JournalMood = Mood;
