import { logger } from "@/lib/logger";

export interface PurgePayload {
  deletionRequestId: string;
}

export async function enqueuePurgeUser(deletionRequestId: string): Promise<void> {
  logger.info({ deletionRequestId }, "purge_user_queued");
}
