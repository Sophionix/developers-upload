import { NextResponse, type NextRequest } from "next/server";
import { redis } from "@/lib/redis";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { enqueueRollup } from "@/lib/jobs/rollup";
import { enqueuePurgeUser } from "@/lib/jobs/purge";
import { enqueueScheduledReminderTick } from "@/lib/jobs/notifications";
import { enqueueScheduledExport } from "@/lib/jobs/exports";

export const runtime = "nodejs";

const VALID_TASKS = new Set([
  "daily-rollup",
  "scheduled-notifications",
  "scheduled-exports",
  "due-purges",
] as const);

type CronTask = "daily-rollup" | "scheduled-notifications" | "scheduled-exports" | "due-purges";

function yesterday(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ task: string }> },
): Promise<NextResponse> {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { task } = await params;
  if (!VALID_TASKS.has(task as CronTask)) {
    return NextResponse.json({ error: "invalid_task" }, { status: 400 });
  }

  const lockKey = `cron:lock:${task}`;
  const acquired = await redis.set(lockKey, "1", "EX", 600, "NX");
  if (!acquired) {
    return NextResponse.json({ error: "lock_held" }, { status: 409 });
  }

  try {
    switch (task as CronTask) {
      case "daily-rollup": {
        await enqueueRollup(yesterday());
        break;
      }
      case "scheduled-notifications": {
        const now = new Date();
        const currentHour = now.getUTCHours();
        const prefs = await prisma.notificationPreference.findMany({
          where: { remindersEnabled: true },
          select: {
            userId: true,
            user: { select: { preferences: { select: { dailyCardAtHour: true } } } },
          },
          take: 1000,
        });
        for (const p of prefs) {
          if (p.user.preferences?.dailyCardAtHour === currentHour) {
            await enqueueScheduledReminderTick({ userId: p.userId });
          }
        }
        break;
      }
      case "scheduled-exports": {
        await enqueueScheduledExport();
        break;
      }
      case "due-purges": {
        const due = await prisma.dataDeletionRequest.findMany({
          where: { scheduledAt: { lte: new Date() }, processedAt: null },
          select: { id: true },
        });
        for (const d of due) {
          await enqueuePurgeUser(d.id);
        }
        break;
      }
    }

    logger.info({ task }, "cron_dispatched");
    return NextResponse.json({ ok: true, task });
  } catch (err) {
    logger.error({ err, task }, "cron_dispatch_failed");
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
