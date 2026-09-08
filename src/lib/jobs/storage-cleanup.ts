import { logger } from "@/lib/logger";

export interface StorageCleanupPayload {
  path: string;
}

export async function enqueueStorageCleanup(
  input: StorageCleanupPayload,
): Promise<void> {
  logger.info({ path: input.path }, "storage_cleanup_queued");
}
