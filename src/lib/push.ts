import type { MulticastMessage } from "firebase-admin/messaging";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getMessaging, isMessagingConfigured } from "@/lib/firebase-admin";

const MULTICAST_CHUNK = 500;
const PRUNE_ERROR_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
]);

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  link?: string;
}

export interface PushResult {
  sent: number;
  failed: number;
  pruned: number;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function buildMessage(tokens: string[], payload: PushPayload): MulticastMessage {
  const webpush = payload.link
    ? { fcmOptions: { link: payload.link } }
    : undefined;
  return {
    tokens,
    notification: { title: payload.title, body: payload.body },
    ...(payload.data && { data: payload.data }),
    ...(webpush && { webpush }),
  };
}

export async function sendPush(
  userIds: string[],
  payload: PushPayload,
): Promise<PushResult> {
  const result: PushResult = { sent: 0, failed: 0, pruned: 0 };
  if (userIds.length === 0) return result;
  if (!isMessagingConfigured()) {
    logger.warn("push_skipped_not_configured");
    return result;
  }

  const tokenRows = await prisma.fcmToken.findMany({
    where: { userId: { in: userIds } },
    select: { id: true, token: true },
  });
  if (tokenRows.length === 0) return result;

  const messaging = getMessaging();
  const toPrune: string[] = [];

  for (const batch of chunk(tokenRows, MULTICAST_CHUNK)) {
    const tokens = batch.map((t) => t.token);
    try {
      const resp = await messaging.sendEachForMulticast(
        buildMessage(tokens, payload),
      );
      result.sent += resp.successCount;
      result.failed += resp.failureCount;
      resp.responses.forEach((r, idx) => {
        if (r.success) return;
        const code = r.error?.code;
        if (code && PRUNE_ERROR_CODES.has(code)) {
          const row = batch[idx];
          if (row) toPrune.push(row.id);
        }
      });
    } catch (err) {
      result.failed += tokens.length;
      logger.error({ err }, "push_batch_failed");
    }
  }

  if (toPrune.length > 0) {
    try {
      const del = await prisma.fcmToken.deleteMany({
        where: { id: { in: toPrune } },
      });
      result.pruned = del.count;
    } catch (err) {
      logger.error({ err }, "push_prune_failed");
    }
  }

  return result;
}

// WHY: topic fan-out requires user opt-in subscription before publish.
export async function sendPushToTopic(
  topic: string,
  payload: PushPayload,
): Promise<{ messageId: string } | null> {
  if (!isMessagingConfigured()) {
    logger.warn("push_topic_skipped_not_configured");
    return null;
  }
  try {
    const messageId = await getMessaging().send({
      topic,
      notification: { title: payload.title, body: payload.body },
      ...(payload.data && { data: payload.data }),
      ...(payload.link && { webpush: { fcmOptions: { link: payload.link } } }),
    });
    return { messageId };
  } catch (err) {
    logger.error({ err, topic }, "push_topic_failed");
    return null;
  }
}
