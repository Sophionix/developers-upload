import { CampaignStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { sendPush, type PushResult } from "@/lib/push";
import {
  resolveCampaignAudience,
  campaignSegmentSchema,
  type CampaignSegment,
} from "@/lib/segments";

export const NOTIFICATIONS_QUEUE = "notifications";

export const NOTIFICATION_JOBS = {
  campaignFanout: "campaign-fanout",
  reminderTick: "reminder-tick",
} as const;

export type NotificationJobName =
  (typeof NOTIFICATION_JOBS)[keyof typeof NOTIFICATION_JOBS];

/** Batch size for creating delivery records */
const DELIVERY_BATCH = 500;

/**
 * Execute the campaign fanout: resolve audience, send push notifications,
 * record delivery rows, and update campaign stats.
 *
 * WHY not a queue worker: BullMQ infrastructure isn't wired yet.
 * This runs inline but is structured so it can be moved behind a queue later.
 */
export async function enqueueNotificationFanout(input: {
  campaignId: string;
}): Promise<void> {
  const { campaignId } = input;
  logger.info({ campaignId }, "notification_fanout_start");

  try {
    // 1. Load campaign + template
    const campaign = await prisma.notificationCampaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        type: true,
        segmentJson: true,
        template: { select: { title: true, body: true } },
      },
    });

    if (!campaign) {
      logger.error({ campaignId }, "notification_fanout_campaign_not_found");
      return;
    }

    // 2. Parse segment and resolve audience
    const segment = campaignSegmentSchema.parse(
      campaign.segmentJson,
    ) as CampaignSegment;
    const userIds = await resolveCampaignAudience(segment);

    if (userIds.length === 0) {
      logger.info({ campaignId }, "notification_fanout_empty_audience");
      await prisma.notificationCampaign.update({
        where: { id: campaignId },
        data: { stats: { sent: 0, failed: 0, pruned: 0, audience: 0 } },
      });
      return;
    }

    // 3. Send push notifications
    const title = campaign.template.title ?? "Sophionix";
    const body = campaign.template.body;

    const pushResult: PushResult = await sendPush(userIds, {
      title,
      body,
      data: { campaignId },
    });

    logger.info(
      { campaignId, ...pushResult, audience: userIds.length },
      "notification_fanout_push_complete",
    );

    // 4. Create delivery records in batches
    for (let i = 0; i < userIds.length; i += DELIVERY_BATCH) {
      const batch = userIds.slice(i, i + DELIVERY_BATCH);
      await prisma.notificationDelivery.createMany({
        data: batch.map((userId) => ({
          campaignId,
          userId,
          type: campaign.type,
          // WHY "DELIVERED" for all: we don't have per-user delivery tracking
          // from FCM multicast — only aggregate counts. Individual token
          // failures are handled by token pruning in push.ts.
          status: "DELIVERED",
        })),
        skipDuplicates: true,
      });
    }

    // 5. Update campaign stats
    await prisma.notificationCampaign.update({
      where: { id: campaignId },
      data: {
        stats: {
          audience: userIds.length,
          sent: pushResult.sent,
          failed: pushResult.failed,
          pruned: pushResult.pruned,
        },
      },
    });

    logger.info({ campaignId }, "notification_fanout_complete");
  } catch (err) {
    logger.error({ err, campaignId }, "notification_fanout_failed");

    // Mark campaign as FAILED so admin can see something went wrong
    try {
      await prisma.notificationCampaign.update({
        where: { id: campaignId },
        data: { status: CampaignStatus.FAILED },
      });
    } catch (updateErr) {
      logger.error(
        { err: updateErr, campaignId },
        "notification_fanout_status_update_failed",
      );
    }
  }
}

export async function enqueueScheduledReminderTick(input: {
  userId: string;
  scheduledAt?: Date;
}): Promise<void> {
  logger.info({ userId: input.userId }, "reminder_tick_queued");
}
