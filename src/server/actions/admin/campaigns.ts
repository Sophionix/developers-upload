"use server";

import { Prisma } from "@/generated/prisma/client";
import { CampaignStatus, UserRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { requireRole } from "@/lib/rbac";
import { logAdminAction } from "@/lib/audit";
import { invalidateTag } from "@/lib/cache";
import { decodeCursor, paginateKeyset } from "@/lib/pagination";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { enqueueNotificationFanout } from "@/lib/jobs/notifications";
import { resolveCampaignAudience } from "@/lib/segments";
import {
  toCampaignDto,
  type CampaignDto,
  type CampaignStatsDto,
} from "@/lib/dto/admin-campaigns";
import {
  createCampaignSchema,
  getCampaignStatsSchema,
  listCampaignsSchema,
  previewAudienceSchema,
  scheduleCampaignSchema,
  sendCampaignNowSchema,
  type CreateCampaignInput,
  type GetCampaignStatsInput,
  type ListCampaignsInput,
  type PreviewAudienceInput,
  type ScheduleCampaignInput,
  type SendCampaignNowInput,
} from "@/lib/validation/admin-campaigns";

const CAMPAIGNS_TAG = "notification-campaigns";
const AUDIENCE_PREVIEW_CAP = 1000;

const CAMPAIGN_SELECT = {
  id: true,
  name: true,
  templateId: true,
  type: true,
  segmentJson: true,
  scheduledAt: true,
  sentAt: true,
  status: true,
  createdByAdminId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.NotificationCampaignSelect;

async function assertContentOrSuperAdmin(): Promise<{ userId: string }> {
  await requireUser();
  const { userId } = await requireRole([
    UserRole.SUPER_ADMIN,
    UserRole.CONTENT_MANAGER,
  ]);
  return { userId };
}

export async function adminListCampaigns(
  input: ListCampaignsInput,
): Promise<{ items: CampaignDto[]; nextCursor: string | null }> {
  await assertContentOrSuperAdmin();
  const { cursor, take = 20, status, type } = listCampaignsSchema.parse(input);
  const decoded = decodeCursor(cursor);

  const where: Prisma.NotificationCampaignWhereInput = {
    ...(status && { status }),
    ...(type && { type }),
    ...(decoded && {
      OR: [
        { createdAt: { lt: decoded.createdAt } },
        { createdAt: decoded.createdAt, id: { lt: decoded.id } },
      ],
    }),
  };

  const rows = await prisma.notificationCampaign.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
    select: CAMPAIGN_SELECT,
  });

  const page = paginateKeyset(rows, take, false);
  return {
    items: page.rows.map(toCampaignDto),
    nextCursor: page.nextCursor,
  };
}

export async function adminCreateCampaign(
  input: CreateCampaignInput,
): Promise<CampaignDto> {
  const { userId } = await assertContentOrSuperAdmin();
  const data = createCampaignSchema.parse(input);

  const template = await prisma.notificationTemplate.findUnique({
    where: { id: data.templateId },
    select: { id: true, type: true },
  });
  if (!template) throw new NotFoundError("template_not_found");
  if (template.type !== data.channel) {
    throw new ValidationError("channel_template_mismatch");
  }

  const row = await prisma.notificationCampaign.create({
    data: {
      name: data.name,
      templateId: data.templateId,
      type: data.channel,
      segmentJson: data.segment as Prisma.InputJsonValue,
      scheduledAt: data.scheduledAt ?? null,
      status: data.scheduledAt ? CampaignStatus.SCHEDULED : CampaignStatus.DRAFT,
      createdByAdminId: userId,
    },
    select: CAMPAIGN_SELECT,
  });

  await invalidateTag(CAMPAIGNS_TAG);
  await logAdminAction({
    actorId: userId,
    action: "CREATE",
    entity: "NotificationCampaign",
    entityId: row.id,
    meta: { name: row.name, type: row.type, status: row.status },
  });
  return toCampaignDto(row);
}

export async function adminScheduleCampaign(
  input: ScheduleCampaignInput,
): Promise<CampaignDto> {
  const { userId } = await assertContentOrSuperAdmin();
  const { id, scheduledAt } = scheduleCampaignSchema.parse(input);

  const existing = await prisma.notificationCampaign.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!existing) throw new NotFoundError("campaign_not_found");
  if (existing.status !== CampaignStatus.DRAFT) {
    throw new ConflictError("campaign_not_draft");
  }

  const row = await prisma.notificationCampaign.update({
    where: { id },
    data: { scheduledAt, status: CampaignStatus.SCHEDULED },
    select: CAMPAIGN_SELECT,
  });

  await invalidateTag(CAMPAIGNS_TAG);
  await logAdminAction({
    actorId: userId,
    action: "UPDATE",
    entity: "NotificationCampaign",
    entityId: id,
    meta: { op: "schedule", scheduledAt: scheduledAt.toISOString() },
  });
  return toCampaignDto(row);
}

export async function adminSendCampaignNow(
  input: SendCampaignNowInput,
): Promise<CampaignDto> {
  const { userId } = await assertContentOrSuperAdmin();
  const { id } = sendCampaignNowSchema.parse(input);

  const existing = await prisma.notificationCampaign.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!existing) throw new NotFoundError("campaign_not_found");
  if (
    existing.status !== CampaignStatus.DRAFT &&
    existing.status !== CampaignStatus.SCHEDULED
  ) {
    throw new ConflictError("campaign_illegal_transition");
  }

  const row = await prisma.notificationCampaign.update({
    where: { id },
    data: { status: CampaignStatus.SENT, sentAt: new Date() },
    select: CAMPAIGN_SELECT,
  });

  await enqueueNotificationFanout({ campaignId: id });

  await invalidateTag(CAMPAIGNS_TAG);
  await logAdminAction({
    actorId: userId,
    action: "UPDATE",
    entity: "NotificationCampaign",
    entityId: id,
    meta: { op: "send_now", enqueued: true },
  });
  return toCampaignDto(row);
}

export async function adminPreviewCampaignAudience(
  input: PreviewAudienceInput,
): Promise<{ count: number; capped: boolean }> {
  await assertContentOrSuperAdmin();
  const { segment } = previewAudienceSchema.parse(input);
  const ids = await resolveCampaignAudience(segment, {
    cap: AUDIENCE_PREVIEW_CAP,
  });
  return { count: ids.length, capped: ids.length === AUDIENCE_PREVIEW_CAP };
}

export async function adminGetCampaignStats(
  input: GetCampaignStatsInput,
): Promise<CampaignStatsDto> {
  await assertContentOrSuperAdmin();
  const { id } = getCampaignStatsSchema.parse(input);

  const campaign = await prisma.notificationCampaign.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!campaign) throw new NotFoundError("campaign_not_found");

  const groups = await prisma.notificationDelivery.groupBy({
    by: ["status"],
    where: { campaignId: id },
    _count: { _all: true },
  });

  const byStatus: Record<string, number> = {};
  let total = 0;
  for (const g of groups) {
    byStatus[g.status] = g._count._all;
    total += g._count._all;
  }

  return {
    campaignId: id,
    status: campaign.status,
    total,
    byStatus,
  };
}
