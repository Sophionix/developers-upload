import { logger } from "@/lib/logger";

export interface ExportJobPayload {
  exportRequestId: string;
}

export async function enqueueExportJob(
  input: ExportJobPayload,
): Promise<void> {
  logger.info({ exportRequestId: input.exportRequestId }, "export_job_queued");
}

export async function enqueueScheduledExport(): Promise<void> {
  logger.info("scheduled_export_queued");
}
