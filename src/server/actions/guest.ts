import type { Prisma } from "@/generated/prisma/client";
import { sha256Hex } from "@/lib/crypto";
import { verifyGuestCookie } from "@/lib/guest-session";
import { logger } from "@/lib/logger";

/**
 * Transfers unlocks + payments from a guest session to a newly-signed-up user.
 * Called from the signup flow inside the same transaction.
 * Returns the count of CardUnlock rows migrated.
 */
export async function claimGuestUnlocks(input: {
  guestCookieRaw: string | null;
  newUserId: string;
  tx: Prisma.TransactionClient;
}): Promise<number> {
  const { guestCookieRaw, newUserId, tx } = input;
  if (!guestCookieRaw) return 0;
  const id = verifyGuestCookie(guestCookieRaw);
  if (!id) return 0;

  const guest = await tx.guestSession.findUnique({
    where: { cookieHash: sha256Hex(guestCookieRaw) },
    select: { id: true, claimedAt: true },
  });
  if (!guest || guest.id !== id || guest.claimedAt) return 0;

  const guestUnlocks = await tx.cardUnlock.findMany({
    where: { guestSessionId: guest.id, status: { in: ["SUCCEEDED", "PENDING"] } },
    select: { id: true, cardId: true },
  });

  let claimed = 0;
  for (const unlock of guestUnlocks) {
    const conflict = await tx.cardUnlock.findUnique({
      where: { userId_cardId: { userId: newUserId, cardId: unlock.cardId } },
      select: { id: true },
    });
    if (conflict) {
      // WHY: unique(userId, cardId) — keep the earlier user-owned unlock, drop guest row
      await tx.cardUnlock.delete({ where: { id: unlock.id } });
      logger.warn(
        { guestUnlockId: unlock.id, existingUnlockId: conflict.id, userId: newUserId },
        "guest_unlock_conflict_discarded",
      );
      continue;
    }
    await tx.cardUnlock.update({
      where: { id: unlock.id },
      data: { userId: newUserId, guestSessionId: null },
    });
    claimed += 1;
  }

  await tx.payment.updateMany({
    where: { guestSessionId: guest.id },
    data: { userId: newUserId, guestSessionId: null },
  });

  await tx.guestSession.update({
    where: { id: guest.id },
    data: { claimedByUserId: newUserId, claimedAt: new Date() },
  });

  return claimed;
}
