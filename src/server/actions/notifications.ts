"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import type { NotificationType } from "@/generated/prisma/client";

const listNotificationsSchema = z.object({
  cursor: z.string().optional(),
  take: z.number().int().min(1).max(100).optional(),
});

export interface NotificationDto {
  id: string;
  title: string;
  body: string;
  type: NotificationType;
  createdAt: Date;
}

export async function listNotifications(
  rawInput: { cursor?: string; take?: number } = {},
): Promise<{ items: NotificationDto[]; nextCursor: string | null }> {
  const input = listNotificationsSchema.parse(rawInput);
  const user = await requireUser();
  const take = input.take ?? 20;

  const deliveries = await prisma.notificationDelivery.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: take + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    select: {
      id: true,
      campaignId: true,
      type: true,
      createdAt: true,
    },
  });

  const hasMore = deliveries.length > take;
  const page = hasMore ? deliveries.slice(0, take) : deliveries;

  const campaignIds = [...new Set(page.map((d) => d.campaignId))];
  const campaigns = await prisma.notificationCampaign.findMany({
    where: { id: { in: campaignIds } },
    select: {
      id: true,
      template: { select: { title: true, body: true } },
    },
  });
  const campaignMap = new Map(campaigns.map((c) => [c.id, c]));

  const items: NotificationDto[] = page.map((d) => {
    const campaign = campaignMap.get(d.campaignId);
    return {
      id: d.id,
      title: campaign?.template.title ?? "Notification",
      body: campaign?.template.body ?? "",
      type: d.type,
      createdAt: d.createdAt,
    };
  });

  return {
    items,
    nextCursor: hasMore ? page[take - 1]!.id : null,
  };
}
