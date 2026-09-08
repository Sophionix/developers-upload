import { Prisma, type AuditAction } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

export interface AuditActionInput {
  actorId: string;
  action: AuditAction;
  entity: string;
  entityId?: string;
  targetUserId?: string;
  meta?: Prisma.InputJsonValue;
  ip?: string;
}

const SENSITIVE_KEY = /password|token|secret|authorization|cookie/i;

function scrubValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(scrubValue);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEY.test(k) ? "[REDACTED]" : scrubValue(v);
    }
    return out;
  }
  return value;
}

export async function withAudit<T>(
  fn: () => Promise<T>,
  entry: AuditActionInput,
): Promise<T> {
  try {
    const result = await fn();
    await logAdminAction(entry);
    return result;
  } catch (err) {
    const errorMeta: Prisma.InputJsonObject = {
      error: err instanceof Error ? err.message : String(err),
    };
    const prevMeta = entry.meta;
    const mergedMeta: Prisma.InputJsonValue =
      prevMeta && typeof prevMeta === "object" && !Array.isArray(prevMeta)
        ? { ...(prevMeta as Prisma.InputJsonObject), ...errorMeta }
        : errorMeta;
    await logAdminAction({ ...entry, meta: mergedMeta });
    throw err;
  }
}

export async function logAdminAction(input: AuditActionInput): Promise<void> {
  try {
    const scrubbedMeta =
      input.meta === undefined
        ? undefined
        : (scrubValue(input.meta) as Prisma.InputJsonValue);
    await prisma.adminAuditLog.create({
      data: {
        actorId: input.actorId,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        targetUserId: input.targetUserId ?? null,
        meta: scrubbedMeta ?? Prisma.JsonNull,
        ip: input.ip ?? null,
      },
    });
  } catch (err) {
    logger.error(
      { err, entity: input.entity, action: input.action },
      "audit_write_failed",
    );
  }
}
