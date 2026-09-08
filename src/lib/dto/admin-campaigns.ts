import type {
  CampaignStatus,
  NotificationType,
} from "@/generated/prisma/enums";

export interface TemplateDto {
  id: string;
  slug: string;
  type: NotificationType;
  subject: string | null;
  title: string | null;
  body: string;
  variables: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateRow {
  id: string;
  slug: string;
  type: NotificationType;
  subject: string | null;
  title: string | null;
  body: string;
  variables: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export function toTemplateDto(row: TemplateRow): TemplateDto {
  return {
    id: row.id,
    slug: row.slug,
    type: row.type,
    subject: row.subject,
    title: row.title,
    body: row.body,
    variables: Array.isArray(row.variables)
      ? (row.variables as unknown[]).filter(
          (v): v is string => typeof v === "string",
        )
      : [],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export interface CampaignDto {
  id: string;
  name: string;
  templateId: string;
  type: NotificationType;
  segment: unknown;
  scheduledAt: Date | null;
  sentAt: Date | null;
  status: CampaignStatus;
  createdByAdminId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CampaignRow {
  id: string;
  name: string;
  templateId: string;
  type: NotificationType;
  segmentJson: unknown;
  scheduledAt: Date | null;
  sentAt: Date | null;
  status: CampaignStatus;
  createdByAdminId: string;
  createdAt: Date;
  updatedAt: Date;
}

export function toCampaignDto(row: CampaignRow): CampaignDto {
  return {
    id: row.id,
    name: row.name,
    templateId: row.templateId,
    type: row.type,
    segment: row.segmentJson,
    scheduledAt: row.scheduledAt,
    sentAt: row.sentAt,
    status: row.status,
    createdByAdminId: row.createdByAdminId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export interface CampaignStatsDto {
  campaignId: string;
  status: CampaignStatus;
  total: number;
  byStatus: Record<string, number>;
}
