import { logger } from "@/lib/logger";

export interface RollupPayload {
  dateIso: string;
}

export async function enqueueRollup(dateIso: string): Promise<void> {
  logger.info({ dateIso }, "rollup_queued");
}
