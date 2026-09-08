import { z } from "zod";

const cursor = z.string().min(1).max(512);
const take = z.number().int().min(1).max(50);

export const MAX_RANGE_DAYS = 365;

export const rangeSchema = z
  .object({
    rangeDays: z.number().int().min(1).max(MAX_RANGE_DAYS).default(30),
  })
  .strict();
export type RangeInput = z.infer<typeof rangeSchema>;

export const cohortRangeSchema = z
  .object({
    cohortMonths: z.number().int().min(1).max(24).default(6),
  })
  .strict();
export type CohortRangeInput = z.infer<typeof cohortRangeSchema>;

export const cardUsageSchema = z
  .object({
    rangeDays: z.number().int().min(1).max(MAX_RANGE_DAYS).default(30),
    top: z.number().int().min(1).max(200).default(50),
  })
  .strict();
export type CardUsageInput = z.infer<typeof cardUsageSchema>;

export const activityFeedSchema = z
  .object({
    cursor: cursor.optional(),
    take: take.optional(),
  })
  .strict();
export type ActivityFeedInput = z.infer<typeof activityFeedSchema>;
