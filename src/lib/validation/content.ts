import { z } from "zod";

const mood = z.enum([
  "JOYFUL",
  "CALM",
  "GRATEFUL",
  "NEUTRAL",
  "TIRED",
  "ANXIOUS",
  "SAD",
  "ANGRY",
  "STRESSED",
  "HOPEFUL",
]);
const accessType = z.enum(["FREE", "PREMIUM"]);
const cursor = z.string().min(1).max(512);
const id = z.string().min(1).max(40);

export const listDecksSchema = z
  .object({
    cursor: cursor.optional(),
    take: z.number().int().min(1).max(50).optional(),
  })
  .strict();
export type ListDecksInput = z.infer<typeof listDecksSchema>;

export const listCardsSchema = z
  .object({
    deckId: id.optional(),
    themeId: id.optional(),
    tagId: id.optional(),
    mood: mood.optional(),
    accessType: accessType.optional(),
    cursor: cursor.optional(),
    take: z.number().int().min(1).max(50).optional(),
  })
  .strict();
export type ListCardsInput = z.infer<typeof listCardsSchema>;

export const getCardSchema = z.object({ id }).strict();
export type GetCardInput = z.infer<typeof getCardSchema>;

export const drawRandomFromDeckSchema = z
  .object({ deckId: id })
  .strict();
export type DrawRandomFromDeckInput = z.infer<typeof drawRandomFromDeckSchema>;

export const drawRandomCardSchema = z
  .object({
    deckId: id.optional(),
    themeId: id.optional(),
    tagId: id.optional(),
    accessType: accessType.optional(),
  })
  .strict();
export type DrawRandomCardInput = z.infer<typeof drawRandomCardSchema>;

export const saveCardSchema = z.object({ cardId: id }).strict();
export type SaveCardInput = z.infer<typeof saveCardSchema>;

// A reading is 1 or 2 cards saved together as one group.
export const saveCardGroupSchema = z
  .object({ cardIds: z.array(id).min(1).max(2) })
  .strict();
export type SaveCardGroupInput = z.infer<typeof saveCardGroupSchema>;

export const listSavedCardsSchema = z
  .object({
    cursor: cursor.optional(),
    take: z.number().int().min(1).max(50).optional(),
  })
  .strict();
export type ListSavedCardsInput = z.infer<typeof listSavedCardsSchema>;

export const logMoodSchema = z
  .object({
    mood,
    note: z.string().trim().max(500).optional(),
    linkedCardId: id.optional(),
    linkedDrawId: id.optional(),
  })
  .strict();
export type LogMoodInput = z.infer<typeof logMoodSchema>;

export const getMoodTrendsSchema = z
  .object({ rangeDays: z.number().int().min(1).max(365) })
  .strict();
export type GetMoodTrendsInput = z.infer<typeof getMoodTrendsSchema>;
