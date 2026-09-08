import type {
  SubscriptionStatus,
  SubscriptionTier,
} from "@/generated/prisma/enums";

export interface AdminOverviewDto {
  totalUsers: number;
  activeSubscriptions: number;
  premiumUsers: number;
  mrrCents: number;
  dailyCardDraws: number;
  totalJournalEntries: number;
}

export interface SubscriptionSummaryDto {
  distribution: Array<{
    tier: SubscriptionTier;
    status: SubscriptionStatus;
    count: number;
  }>;
  churnRate30d: number;
}

export interface ActivityFeedItem {
  id: string;
  kind: "audit" | "payment";
  createdAt: Date;
  actorId: string | null;
  summary: string;
}

export interface ActivityFeedDto {
  items: ActivityFeedItem[];
  nextCursor: string | null;
}

export interface TimeSeriesPoint {
  date: string;
  dau: number;
  wau: number;
  mau: number;
}

export interface DauWauMauDto {
  points: TimeSeriesPoint[];
}

export interface RetentionCohortDto {
  points: Array<{
    cohortDate: string;
    dayOffset: number;
    size: number;
    retained: number;
  }>;
}

export interface MoodTrendPoint {
  date: string;
  distribution: Record<string, number>;
}

export interface MoodTrendsDto {
  points: MoodTrendPoint[];
}

export interface CardUsageRow {
  cardId: string;
  cardName: string;
  draws: number;
  saves: number;
  unlocks: number;
}

export interface CardUsageDto {
  rows: CardUsageRow[];
}

export interface ChurnIndicatorsDto {
  cancellations: number;
  churnCount: number;
  paidConversions: number;
  revenueCents: number;
}
