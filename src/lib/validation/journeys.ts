import { z } from "zod";

const id = z.string().min(1).max(40);
const cursor = z.string().min(1).max(512);

export const listJourneysSchema = z
  .object({
    cursor: cursor.optional(),
    take: z.number().int().min(1).max(50).optional(),
  })
  .strict();
export type ListJourneysInput = z.infer<typeof listJourneysSchema>;

export const getJourneySchema = z.object({ id }).strict();
export type GetJourneyInput = z.infer<typeof getJourneySchema>;

export const enrollInJourneySchema = z.object({ journeyId: id }).strict();
export type EnrollInJourneyInput = z.infer<typeof enrollInJourneySchema>;

export const getEnrollmentProgressSchema = z.object({ journeyId: id }).strict();
export type GetEnrollmentProgressInput = z.infer<
  typeof getEnrollmentProgressSchema
>;

export const advanceJourneyDaySchema = z.object({ journeyId: id }).strict();
export type AdvanceJourneyDayInput = z.infer<typeof advanceJourneyDaySchema>;
