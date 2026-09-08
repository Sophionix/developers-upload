import type {
  CardAccessType,
  JourneyAccessType,
  PromptType,
} from "@/generated/prisma/enums";

// ============================================================================
// Decks
// ============================================================================

export interface AdminDeckDto {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function toAdminDeckDto(row: AdminDeckDto): AdminDeckDto {
  return row;
}

// ============================================================================
// Cards
// ============================================================================

export interface AdminCardListDto {
  id: string;
  deckId: string;
  title: string;
  imageUrl: string | null;
  iconKey: string | null;
  accessType: CardAccessType;
  guestPreview: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminCardDetailDto extends AdminCardListDto {
  message: string;
  prompt: string | null;
  themeIds: string[];
  tagIds: string[];
}

export interface AdminCardRow {
  id: string;
  deckId: string;
  title: string;
  message: string;
  prompt: string | null;
  imageUrl: string | null;
  iconKey: string | null;
  accessType: CardAccessType;
  guestPreview: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export function toAdminCardListDto(
  row: Omit<AdminCardRow, "message" | "prompt">,
): AdminCardListDto {
  return {
    id: row.id,
    deckId: row.deckId,
    title: row.title,
    imageUrl: row.imageUrl,
    iconKey: row.iconKey,
    accessType: row.accessType,
    guestPreview: row.guestPreview,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toAdminCardDetailDto(
  row: AdminCardRow,
  themeIds: string[],
  tagIds: string[],
): AdminCardDetailDto {
  return {
    ...toAdminCardListDto(row),
    message: row.message,
    prompt: row.prompt,
    themeIds,
    tagIds,
  };
}

// ============================================================================
// Themes / Tags / Categories
// ============================================================================

export interface AdminTaxonomyDto {
  id: string;
  slug: string;
  name: string;
  createdAt?: Date;
}

// ============================================================================
// Prompts
// ============================================================================

export interface AdminPromptDto {
  id: string;
  text: string;
  type: PromptType;
  isActive: boolean;
  categoryIds: string[];
  themeIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Journeys
// ============================================================================

export interface AdminJourneyListDto {
  id: string;
  slug: string;
  title: string;
  description: string;
  durationDays: number;
  accessType: JourneyAccessType;
  thumbnailUrl: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminJourneyDayDto {
  id: string;
  journeyId: string;
  dayIndex: number;
  cardId: string | null;
  promptText: string | null;
  quote: string | null;
  audioUrl: string | null;
}

// ============================================================================
// Scheduled daily cards
// ============================================================================

export interface AdminScheduledDailyCardDto {
  id: string;
  date: Date;
  cardId: string;
  isGlobal: boolean;
  createdAt: Date;
}
