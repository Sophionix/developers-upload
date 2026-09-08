import { z } from "zod";
import { campaignSegmentSchema } from "@/lib/segments";

const id = z.string().min(1).max(40);
const cursor = z.string().min(1).max(512);
const take = z.number().int().min(1).max(50);

const slug = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "invalid_slug");
const notificationType = z.enum(["PUSH", "EMAIL"]);
const campaignStatus = z.enum(["DRAFT", "SCHEDULED", "SENT", "FAILED"]);

const variables = z.array(z.string().min(1).max(60)).max(50);

export const listTemplatesSchema = z
  .object({
    cursor: cursor.optional(),
    take: take.optional(),
    type: notificationType.optional(),
    search: z.string().trim().min(1).max(80).optional(),
  })
  .strict();
export type ListTemplatesInput = z.infer<typeof listTemplatesSchema>;

export const createTemplateSchema = z
  .object({
    slug,
    type: notificationType,
    subject: z.string().trim().max(200).optional(),
    title: z.string().trim().max(200).optional(),
    body: z.string().trim().min(1).max(20_000),
    variables: variables.default([]),
  })
  .strict();
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;

export const updateTemplateSchema = z
  .object({
    id,
    slug: slug.optional(),
    type: notificationType.optional(),
    subject: z.string().trim().max(200).nullable().optional(),
    title: z.string().trim().max(200).nullable().optional(),
    body: z.string().trim().min(1).max(20_000).optional(),
    variables: variables.optional(),
  })
  .strict();
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;

export const deleteTemplateSchema = z.object({ id }).strict();
export type DeleteTemplateInput = z.infer<typeof deleteTemplateSchema>;

export const listCampaignsSchema = z
  .object({
    cursor: cursor.optional(),
    take: take.optional(),
    status: campaignStatus.optional(),
    type: notificationType.optional(),
  })
  .strict();
export type ListCampaignsInput = z.infer<typeof listCampaignsSchema>;

export const createCampaignSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    templateId: id,
    channel: notificationType,
    segment: campaignSegmentSchema,
    scheduledAt: z.coerce.date().optional(),
  })
  .strict();
export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;

export const scheduleCampaignSchema = z
  .object({
    id,
    scheduledAt: z.coerce.date(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.scheduledAt.getTime() <= Date.now()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "scheduledAt_must_be_in_future",
        path: ["scheduledAt"],
      });
    }
  });
export type ScheduleCampaignInput = z.infer<typeof scheduleCampaignSchema>;

export const sendCampaignNowSchema = z.object({ id }).strict();
export type SendCampaignNowInput = z.infer<typeof sendCampaignNowSchema>;

export const previewAudienceSchema = z
  .object({ segment: campaignSegmentSchema })
  .strict();
export type PreviewAudienceInput = z.infer<typeof previewAudienceSchema>;

export const getCampaignStatsSchema = z.object({ id }).strict();
export type GetCampaignStatsInput = z.infer<typeof getCampaignStatsSchema>;
