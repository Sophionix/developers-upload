import type { CardAccessType } from "@/generated/prisma/enums";

export interface CardListDto {
  id: string;
  deckId: string;
  title: string;
  imageUrl: string | null;
  iconKey: string | null;
  accessType: CardAccessType;
  sortOrder: number;
  createdAt: Date;
  themeIds: string[];
  tagIds: string[];
}

export interface CardDetailDto extends CardListDto {
  message: string;
  prompt: string | null;
}

export interface CardPreviewDto {
  id: string;
  deckId: string;
  title: string;
  imageUrl: string | null;
  iconKey: string | null;
  accessType: CardAccessType;
  sortOrder: number;
  createdAt: Date;
  blurred: true;
}

export interface CardRow {
  id: string;
  deckId: string;
  title: string;
  message: string;
  prompt: string | null;
  imageUrl: string | null;
  iconKey: string | null;
  accessType: CardAccessType;
  sortOrder: number;
  createdAt: Date;
}

export function toCardListDto(
  card: Omit<CardRow, "message" | "prompt">,
  themeIds: string[],
  tagIds: string[],
): CardListDto {
  return {
    id: card.id,
    deckId: card.deckId,
    title: card.title,
    imageUrl: card.imageUrl,
    iconKey: card.iconKey,
    accessType: card.accessType,
    sortOrder: card.sortOrder,
    createdAt: card.createdAt,
    themeIds,
    tagIds,
  };
}

export function toCardDetailDto(
  card: CardRow,
  themeIds: string[],
  tagIds: string[],
): CardDetailDto {
  return {
    ...toCardListDto(card, themeIds, tagIds),
    message: card.message,
    prompt: card.prompt,
  };
}

export function toCardPreviewDto(
  card: Omit<CardRow, "message" | "prompt">,
): CardPreviewDto {
  return {
    id: card.id,
    deckId: card.deckId,
    title: card.title,
    imageUrl: card.imageUrl,
    iconKey: card.iconKey,
    accessType: card.accessType,
    sortOrder: card.sortOrder,
    createdAt: card.createdAt,
    blurred: true,
  };
}
