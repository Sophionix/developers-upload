import { z } from "zod";

const MOODS = [
  "JOYFUL", "CALM", "GRATEFUL", "NEUTRAL", "TIRED",
  "ANXIOUS", "SAD", "ANGRY", "STRESSED", "HOPEFUL",
] as const;

const tagName = z.string().trim().min(1).max(80);
const tagId = z.string().min(1).max(64);

const bodyHtml = z.string().max(200_000);
const title = z.string().trim().max(200).optional();

export const createJournalEntrySchema = z
  .object({
    title: title,
    bodyHtml: bodyHtml,
    cardId: z.string().min(1).max(64).optional(),
    drawId: z.string().min(1).max(64).optional(),
    moodCheckInId: z.string().min(1).max(64).optional(),
    isDraft: z.boolean().optional(),
    tags: z.array(tagName).max(20).optional(),
  })
  .strict();
export type CreateJournalEntryInput = z.infer<typeof createJournalEntrySchema>;

export const updateJournalEntrySchema = z
  .object({
    id: z.string().min(1).max(64),
    title: title,
    bodyHtml: bodyHtml.optional(),
    cardId: z.string().min(1).max(64).nullable().optional(),
    moodCheckInId: z.string().min(1).max(64).nullable().optional(),
    isDraft: z.boolean().optional(),
    tags: z.array(tagName).max(20).optional(),
  })
  .strict();
export type UpdateJournalEntryInput = z.infer<typeof updateJournalEntrySchema>;

export const autosaveJournalDraftSchema = z
  .object({
    id: z.string().min(1).max(64).optional(),
    title: title,
    bodyHtml: bodyHtml,
    cardId: z.string().min(1).max(64).optional(),
  })
  .strict();
export type AutosaveJournalDraftInput = z.infer<typeof autosaveJournalDraftSchema>;

export const deleteJournalEntrySchema = z
  .object({ id: z.string().min(1).max(64) })
  .strict();
export type DeleteJournalEntryInput = z.infer<typeof deleteJournalEntrySchema>;

export const getJournalEntrySchema = z
  .object({ id: z.string().min(1).max(64) })
  .strict();
export type GetJournalEntryInput = z.infer<typeof getJournalEntrySchema>;

export const listTagSuggestionsSchema = z
  .object({ prefix: z.string().trim().min(1).max(60) })
  .strict();
export type ListTagSuggestionsInput = z.infer<typeof listTagSuggestionsSchema>;

export const listJournalEntriesSchema = z
  .object({
    cursor: z.string().max(512).optional(),
    take: z.number().int().min(1).max(50).default(20),
    tagIds: z.array(tagId).max(20).optional(),
    /** Free-text tags (e.g. from filter UI); entries must match every token (AND). */
    tagTokens: z.array(tagName).max(20).optional(),
    /** Case-insensitive partial match on entry title. */
    titleContains: z.string().trim().max(200).optional(),
    cardId: z.string().min(1).max(64).optional(),
    moods: z.array(z.enum(MOODS)).max(10).optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    includeDrafts: z.boolean().optional(),
  })
  .strict();
export type ListJournalEntriesInput = z.infer<typeof listJournalEntriesSchema>;

export const getJournalCalendarSchema = z
  .object({ month: z.string().regex(/^\d{4}-\d{2}$/, "invalid_month") })
  .strict();
export type GetJournalCalendarInput = z.infer<typeof getJournalCalendarSchema>;

export const searchJournalSchema = z
  .object({
    q: z.string().trim().min(1).max(200),
    cursor: z.string().max(512).optional(),
    take: z.number().int().min(1).max(50).default(20),
  })
  .strict();
export type SearchJournalInput = z.infer<typeof searchJournalSchema>;

export const requestJournalExportSchema = z
  .object({
    format: z.enum(["CSV", "PDF"]).default("CSV"),
    tagIds: z.array(tagId).max(20).optional(),
    cardId: z.string().min(1).max(64).optional(),
    moods: z.array(z.enum(MOODS)).max(10).optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
  })
  .strict();
export type RequestJournalExportInput = z.infer<typeof requestJournalExportSchema>;

export const voiceMimeEnum = z.enum([
  "audio/mpeg",
  "audio/ogg",
  "audio/webm",
  "audio/wav",
  "audio/mp4",
  "audio/aac",
  "audio/flac",
  "audio/x-m4a",
]);

export const voiceNoteUploadUrlSchema = z
  .object({
    contentType: voiceMimeEnum,
    sizeBytes: z.number().int().positive(),
    entryId: z.string().min(1).max(64).optional(),
  })
  .strict();
export type VoiceNoteUploadUrlInput = z.infer<typeof voiceNoteUploadUrlSchema>;

export const attachVoiceNoteSchema = z
  .object({
    entryId: z.string().min(1).max(64),
    path: z.string().min(1).max(500),
    mime: voiceMimeEnum,
    durationMs: z.number().int().positive(),
  })
  .strict();
export type AttachVoiceNoteInput = z.infer<typeof attachVoiceNoteSchema>;

export const deleteVoiceNoteSchema = z
  .object({ id: z.string().min(1).max(64) })
  .strict();
export type DeleteVoiceNoteInput = z.infer<typeof deleteVoiceNoteSchema>;
