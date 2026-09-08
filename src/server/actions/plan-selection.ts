"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { rateLimit } from "@/lib/rate-limit";

const TRIAL_DAYS = 14;

export async function activatePostPlanSelectionTrial(): Promise<boolean> {
  const user = await requireUser();
  const rl = await rateLimit({
    key: `plan-trial:${user.id}`,
    limit: 10,
    windowSec: 3600,
  });
  if (!rl.ok) return false;

  const sub = await prisma.subscription.findUnique({
    where: { userId: user.id },
    select: { tier: true },
  });
  if (!sub) return false;
  if (sub.tier !== "FREE") return true;

  const now = new Date();
  const trialEnd = new Date(now.getTime() + TRIAL_DAYS * 86_400_000);
  await prisma.subscription.update({
    where: { userId: user.id },
    data: {
      tier: "TRIAL",
      status: "TRIALING",
      trialStart: now,
      trialEnd,
    },
  });
  return true;
}
