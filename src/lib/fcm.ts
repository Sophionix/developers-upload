/**
 * FCM convenience re-exports.
 *
 * The actual implementation lives in `@/lib/push` (multicast, token pruning)
 * and `@/lib/firebase-admin` (SDK init). This module provides the simplified
 * API surface requested for direct single/batch sends outside the campaign
 * fanout flow.
 */

import { getMessaging, isMessagingConfigured } from "@/lib/firebase-admin";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

const PRUNE_ERROR_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
]);

/**
 * Send a single push notification to one FCM token.
 * Returns the FCM message ID on success.
 */
export async function sendPushNotification(
  token: string,
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<string> {
  if (!isMessagingConfigured()) {
    throw new Error("FCM not configured");
  }

  const messageId = await getMessaging().send({
    token,
    notification: { title, body },
    ...(data && { data }),
  });

  return messageId;
}

export interface BatchResult {
  successCount: number;
  failureCount: number;
  staleTokenIds: string[];
}

/**
 * Send push notifications to multiple tokens using sendEachForMulticast.
 * Returns counts and identifies stale tokens for cleanup.
 *
 * @param tokens - Array of FCM registration tokens
 * @param title - Notification title
 * @param body - Notification body
 * @param data - Optional data payload
 */
export async function sendPushBatch(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<BatchResult> {
  if (tokens.length === 0) {
    return { successCount: 0, failureCount: 0, staleTokenIds: [] };
  }
  if (!isMessagingConfigured()) {
    logger.warn("fcm_batch_skipped_not_configured");
    return { successCount: 0, failureCount: tokens.length, staleTokenIds: [] };
  }

  const messaging = getMessaging();
  const resp = await messaging.sendEachForMulticast({
    tokens,
    notification: { title, body },
    ...(data && { data }),
  });

  const staleTokens: string[] = [];
  resp.responses.forEach((r, idx) => {
    if (r.success) return;
    const code = r.error?.code;
    if (code && PRUNE_ERROR_CODES.has(code)) {
      const t = tokens[idx];
      if (t) staleTokens.push(t);
    }
  });

  // Clean up stale tokens from the database
  if (staleTokens.length > 0) {
    try {
      await prisma.fcmToken.deleteMany({
        where: { token: { in: staleTokens } },
      });
    } catch (err) {
      logger.error({ err }, "fcm_batch_prune_failed");
    }
  }

  return {
    successCount: resp.successCount,
    failureCount: resp.failureCount,
    staleTokenIds: staleTokens,
  };
}
