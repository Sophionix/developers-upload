import { z } from "zod";

const id = z.string().min(1).max(40);
const cursor = z.string().min(1).max(512);
const take = z.number().int().min(1).max(50);
const slug = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "invalid_slug");
const name = z.string().trim().min(1).max(120);
const shortName = z.string().trim().min(1).max(80);
const description = z.string().trim().max(2000);
const longText = z.string().trim().min(1).max(10_000);
const url = z.string().trim().url().max(500);
const accessType = z.enum(["FREE", "PREMIUM"]);
const journeyAccessType = z.enum(["FREE", "PREMIUM"]);
const promptType = z.enum([
  "REFLECTION",
  "GRATITUDE",
  "AFFIRMATION",
  "QUESTION",
]);
const imageMime = z.enum(["image/png", "image/jpeg", "image/webp"]);
const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "invalid_date");
const monthStr = z.string().regex(/^\d{4}-\d{2}$/, "invalid_month");

// ============================================================================
// Decks
// ============================================================================

export const listDecksSchema = z
  .object({
    cursor: cursor.optional(),
    take: take.optional(),
    isActive: z.boolean().optional(),
    search: z.string().trim().min(1).max(80).optional(),
  })
  .strict();
export type ListDecksInput = z.infer<typeof listDecksSchema>;

export const createDeckSchema = z
  .object({
    slug: slug.optional(),
    title: shortName,
    description: description.optional(),
    coverUrl: url.optional(),
    sortOrder: z.number().int().min(0).max(10_000).default(0),
    isActive: z.boolean().default(true),
  })
  .strict();
export type CreateDeckInput = z.infer<typeof createDeckSchema>;

export const updateDeckSchema = z
  .object({
    id,
    slug: slug.optional(),
    title: shortName.optional(),
    description: description.nullable().optional(),
    coverUrl: url.nullable().optional(),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();
export type UpdateDeckInput = z.infer<typeof updateDeckSchema>;

export const deleteDeckSchema = z.object({ id }).strict();
export type DeleteDeckInput = z.infer<typeof deleteDeckSchema>;

// ============================================================================
// Cards
// ============================================================================

export const listCardsSchema = z
  .object({
    cursor: cursor.optional(),
    take: take.optional(),
    deckId: id.optional(),
    accessType: accessType.optional(),
    isActive: z.boolean().optional(),
    search: z.string().trim().min(1).max(120).optional(),
  })
  .strict();
export type ListCardsInput = z.infer<typeof listCardsSchema>;

export const createCardSchema = z
  .object({
    deckId: id,
    title: z.string().trim().min(1).max(160),
    message: longText,
    prompt: z.string().trim().max(10_000).optional(),
    imageUrl: url.optional(),
    iconKey: z.string().trim().min(1).max(60).optional(),
    accessType: accessType.default("FREE"),
    guestPreview: z.boolean().default(false),
    isActive: z.boolean().default(true),
    sortOrder: z.number().int().min(0).max(10_000).default(0),
    themeIds: z.array(id).max(50).default([]),
    tagIds: z.array(id).max(50).default([]),
  })
  .strict();
export type CreateCardInput = z.infer<typeof createCardSchema>;

export const updateCardSchema = z
  .object({
    id,
    deckId: id.optional(),
    title: z.string().trim().min(1).max(160).optional(),
    message: longText.optional(),
    prompt: z.string().trim().max(10_000).nullable().optional(),
    imageUrl: url.nullable().optional(),
    iconKey: z.string().trim().min(1).max(60).nullable().optional(),
    accessType: accessType.optional(),
    guestPreview: z.boolean().optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
    themeIds: z.array(id).max(50).optional(),
    tagIds: z.array(id).max(50).optional(),
  })
  .strict();
export type UpdateCardInput = z.infer<typeof updateCardSchema>;

export const deleteCardSchema = z.object({ id }).strict();
export type DeleteCardInput = z.infer<typeof deleteCardSchema>;

// ============================================================================
// Themes
// ============================================================================

export const listThemesSchema = z
  .object({
    cursor: cursor.optional(),
    take: take.optional(),
    search: z.string().trim().min(1).max(80).optional(),
  })
  .strict();
export type ListThemesInput = z.infer<typeof listThemesSchema>;

export const createThemeSchema = z
  .object({ slug: slug.optional(), name })
  .strict();
export type CreateThemeInput = z.infer<typeof createThemeSchema>;

export const updateThemeSchema = z
  .object({ id, slug: slug.optional(), name: name.optional() })
  .strict();
export type UpdateThemeInput = z.infer<typeof updateThemeSchema>;

export const deleteThemeSchema = z.object({ id }).strict();
export type DeleteThemeInput = z.infer<typeof deleteThemeSchema>;

// ============================================================================
// Tags
// ============================================================================

export const listTagsSchema = z
  .object({
    cursor: cursor.optional(),
    take: take.optional(),
    search: z.string().trim().min(1).max(80).optional(),
  })
  .strict();
export type ListTagsInput = z.infer<typeof listTagsSchema>;

export const createTagSchema = z
  .object({ slug: slug.optional(), name })
  .strict();
export type CreateTagInput = z.infer<typeof createTagSchema>;

export const updateTagSchema = z
  .object({ id, slug: slug.optional(), name: name.optional() })
  .strict();
export type UpdateTagInput = z.infer<typeof updateTagSchema>;

export const deleteTagSchema = z.object({ id }).strict();
export type DeleteTagInput = z.infer<typeof deleteTagSchema>;

// ============================================================================
// Categories
// ============================================================================

export const listCategoriesSchema = z
  .object({
    cursor: cursor.optional(),
    take: take.optional(),
    search: z.string().trim().min(1).max(80).optional(),
  })
  .strict();
export type ListCategoriesInput = z.infer<typeof listCategoriesSchema>;

export const createCategorySchema = z
  .object({ slug: slug.optional(), name })
  .strict();
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = z
  .object({ id, slug: slug.optional(), name: name.optional() })
  .strict();
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

export const deleteCategorySchema = z.object({ id }).strict();
export type DeleteCategoryInput = z.infer<typeof deleteCategorySchema>;

// ============================================================================
// Prompts
// ============================================================================

export const listPromptsSchema = z
  .object({
    cursor: cursor.optional(),
    take: take.optional(),
    type: promptType.optional(),
    isActive: z.boolean().optional(),
    search: z.string().trim().min(1).max(120).optional(),
  })
  .strict();
export type ListPromptsInput = z.infer<typeof listPromptsSchema>;

export const createPromptSchema = z
  .object({
    text: longText,
    type: promptType.default("REFLECTION"),
    isActive: z.boolean().default(true),
    categoryIds: z.array(id).max(50).default([]),
    themeIds: z.array(id).max(50).default([]),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.categoryIds.length === 0 && v.themeIds.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "category_or_theme_required",
        path: ["categoryIds"],
      });
    }
  });
export type CreatePromptInput = z.infer<typeof createPromptSchema>;

export const updatePromptSchema = z
  .object({
    id,
    text: longText.optional(),
    type: promptType.optional(),
    isActive: z.boolean().optional(),
    categoryIds: z.array(id).max(50).optional(),
    themeIds: z.array(id).max(50).optional(),
  })
  .strict();
export type UpdatePromptInput = z.infer<typeof updatePromptSchema>;

export const deletePromptSchema = z.object({ id }).strict();
export type DeletePromptInput = z.infer<typeof deletePromptSchema>;

// ============================================================================
// Journeys
// ============================================================================

export const listJourneysSchema = z
  .object({
    cursor: cursor.optional(),
    take: take.optional(),
    isActive: z.boolean().optional(),
    accessType: journeyAccessType.optional(),
    search: z.string().trim().min(1).max(80).optional(),
  })
  .strict();
export type ListJourneysInput = z.infer<typeof listJourneysSchema>;

export const createJourneySchema = z
  .object({
    slug: slug.optional(),
    title: z.string().trim().min(1).max(160),
    description: longText,
    durationDays: z.number().int().min(1).max(365),
    accessType: journeyAccessType.default("FREE"),
    thumbnailUrl: url.optional(),
    isActive: z.boolean().default(true),
  })
  .strict();
export type CreateJourneyInput = z.infer<typeof createJourneySchema>;

export const updateJourneySchema = z
  .object({
    id,
    slug: slug.optional(),
    title: z.string().trim().min(1).max(160).optional(),
    description: longText.optional(),
    durationDays: z.number().int().min(1).max(365).optional(),
    accessType: journeyAccessType.optional(),
    thumbnailUrl: url.nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .strict();
export type UpdateJourneyInput = z.infer<typeof updateJourneySchema>;

export const deleteJourneySchema = z.object({ id }).strict();
export type DeleteJourneyInput = z.infer<typeof deleteJourneySchema>;

export const listJourneyDaysSchema = z.object({ journeyId: id }).strict();
export type ListJourneyDaysInput = z.infer<typeof listJourneyDaysSchema>;

export const upsertJourneyDaySchema = z
  .object({
    journeyId: id,
    dayIndex: z.number().int().min(1).max(365),
    cardId: id.nullable().optional(),
    promptText: z.string().trim().max(10_000).nullable().optional(),
    quote: z.string().trim().max(2000).nullable().optional(),
    audioUrl: url.nullable().optional(),
  })
  .strict();
export type UpsertJourneyDayInput = z.infer<typeof upsertJourneyDaySchema>;

export const deleteJourneyDaySchema = z.object({ id }).strict();
export type DeleteJourneyDayInput = z.infer<typeof deleteJourneyDaySchema>;

export const reorderJourneyDaysSchema = z
  .object({
    journeyId: id,
    orderedIds: z.array(id).min(1).max(365),
  })
  .strict();
export type ReorderJourneyDaysInput = z.infer<typeof reorderJourneyDaysSchema>;

// ============================================================================
// Scheduled daily cards
// ============================================================================

export const listScheduledDailyCardsSchema = z
  .object({ month: monthStr })
  .strict();
export type ListScheduledDailyCardsInput = z.infer<
  typeof listScheduledDailyCardsSchema
>;

export const scheduleDailyCardSchema = z
  .object({ date: dateStr, cardId: id })
  .strict();
export type ScheduleDailyCardInput = z.infer<typeof scheduleDailyCardSchema>;

export const unscheduleDailyCardSchema = z.object({ date: dateStr }).strict();
export type UnscheduleDailyCardInput = z.infer<
  typeof unscheduleDailyCardSchema
>;

// ============================================================================
// Admin upload URL
// ============================================================================

export const adminUploadUrlSchema = z
  .object({
    contentType: imageMime,
    sizeBytes: z.number().int().positive(),
    kind: z.enum(["card", "journey", "deck"]),
  })
  .strict();
export type AdminUploadUrlInput = z.infer<typeof adminUploadUrlSchema>;
