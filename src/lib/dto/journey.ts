import type { JourneyAccessType } from "@/generated/prisma/enums";

export interface JourneyListDto {
  id: string;
  slug: string;
  title: string;
  description: string;
  durationDays: number;
  accessType: JourneyAccessType;
  thumbnailUrl: string | null;
  createdAt: Date;
}

export interface JourneyDayDto {
  id: string;
  dayIndex: number;
  cardId: string | null;
  promptText: string | null;
  quote: string | null;
  audioUrl: string | null;
}

export interface JourneyDetailDto extends JourneyListDto {
  days: JourneyDayDto[];
}

export interface EnrollmentProgressDto {
  journeyId: string;
  startedAt: Date;
  currentDay: number;
  completedAt: Date | null;
  durationDays: number;
}

interface JourneyRow {
  id: string;
  slug: string;
  title: string;
  description: string;
  durationDays: number;
  accessType: JourneyAccessType;
  thumbnailUrl: string | null;
  createdAt: Date;
}

export function toJourneyListDto(row: JourneyRow): JourneyListDto {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    durationDays: row.durationDays,
    accessType: row.accessType,
    thumbnailUrl: row.thumbnailUrl,
    createdAt: row.createdAt,
  };
}

export function toJourneyDetailDto(
  row: JourneyRow,
  days: JourneyDayDto[],
): JourneyDetailDto {
  return { ...toJourneyListDto(row), days };
}
