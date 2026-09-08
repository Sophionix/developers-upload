/**
 * Seed two demo accounts that look like they have been used for months.
 *
 *   1. A normal registered user  — demo.user@example.com
 *      Pre-verified + ACTIVE + onboarding-complete + PREMIUM, with ~4 months of
 *      backdated history: mood check-ins, card draws, journal entries and saved
 *      cards spread across the timeline so the app's streaks / charts / lists
 *      all look lived-in. Log in with the printed password.
 *
 *   2. A resumable guest        — demo.guest (no login)
 *      A GuestSession row plus a couple of card unlocks. The script derives the
 *      exact signed `soph_guest` cookie value and prints it, so you can paste it
 *      into the browser and resume the guest's session as if you were them.
 *
 * Idempotent: keyed on the demo email / a fixed guest id, so re-running wipes
 * the demo user's generated history and regenerates a fresh timeline rather than
 * piling up duplicates. It only ever touches these two demo records — real users
 * are never affected.
 *
 * History rows reference real cards. It reads active cards at runtime; if the
 * decks are empty it still creates the accounts and just skips card-linked rows.
 *
 * Run on the server (loads .env for DATABASE_URL + GUEST_SESSION_SECRET, same
 * pattern as the other scripts in .github/workflows/deploy.yml):
 *
 *   cd /home/ec2-user/actions-runner/_work/sophionix-pwa/sophionix-pwa
 *   node --env-file=.env node_modules/tsx/dist/cli.mjs scripts/create-test-accounts.ts
 *
 * Remove both demo accounts again:
 *   node --env-file=.env node_modules/tsx/dist/cli.mjs scripts/create-test-accounts.ts --delete
 */
import { createHash, createHmac } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import type { Mood } from "@/generated/prisma/client";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

// example.com is reserved (RFC 2606): no real mail is ever sent and these
// addresses cannot collide with a real user's inbox.
const USER_EMAIL = process.env.DEMO_USER_EMAIL ?? "demo.user@example.com";
const USER_PASSWORD = process.env.DEMO_USER_PASSWORD ?? "Demo@Sophionix1";
const USER_NAME = process.env.DEMO_USER_NAME ?? "Alex Rivera";

// A fixed id so the derived guest cookie is stable across re-runs.
const GUEST_ID = process.env.DEMO_GUEST_ID ?? "demoguestsession000000000001";
const GUEST_EMAIL = process.env.DEMO_GUEST_EMAIL ?? "demo.guest@example.com";

const DELETE = process.argv.includes("--delete");

const DAY = 24 * 60 * 60 * 1000;
const HISTORY_DAYS = 120; // ~4 months of backdated activity.

// ---------------------------------------------------------------------------
// Small deterministic helpers (stable output across runs, no external deps)
// ---------------------------------------------------------------------------

const now = Date.now();
function daysAgo(d: number, hour = 9, minute = 0): Date {
  const t = new Date(now - d * DAY);
  t.setHours(hour, minute, 0, 0);
  return t;
}
function sha256Hex(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}
// Mirrors src/lib/guest-session.ts signGuestCookie() without importing the env
// module (which validates the full runtime config).
function signGuestCookie(id: string): string {
  const secret = process.env.GUEST_SESSION_SECRET;
  if (!secret) throw new Error("GUEST_SESSION_SECRET is not set (needed to sign the guest cookie).");
  const sig = createHmac("sha256", secret).update(id).digest("base64url");
  return `${id}.${sig}`;
}

const MOODS: Mood[] = [
  "JOYFUL", "CALM", "GRATEFUL", "NEUTRAL", "TIRED",
  "ANXIOUS", "SAD", "HOPEFUL", "STRESSED",
];
const MOOD_NOTES = [
  "Slept well and started the day with a short walk.",
  "Busy at work but stayed on top of things.",
  "Grateful for a quiet evening to myself.",
  "Felt a bit anxious before the meeting, better after.",
  "Long day. Running on fumes but proud I showed up.",
  "Good call with an old friend — needed that.",
  "Trying to be kinder to myself this week.",
  "Small win today and I'm choosing to celebrate it.",
  "",
];
const JOURNAL_TITLES = [
  "Morning reflection", "Things I'm grateful for", "A hard day, honestly",
  "Letting go", "What went well this week", "Note to future me",
  "Small joys", "Untangling my thoughts", "Checking in with myself",
];
const JOURNAL_BODIES = [
  "Today I noticed I keep bracing for the worst even when things are fine. Naming it helped. I want to practise trusting the good moments instead of waiting for them to break.",
  "Three things: the coffee was perfect, a stranger held the door, and I finished the thing I'd been avoiding for a week. None of it huge. All of it enough.",
  "It was a heavy one. I didn't handle it perfectly and that's okay. Writing it down so it stops circling in my head.",
  "I'm learning that rest isn't a reward I have to earn. Putting the phone down earlier tonight.",
  "This week I actually asked for help instead of white-knuckling it, and the sky didn't fall. Remember that.",
];

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length]!;
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

async function removeAll(): Promise<void> {
  const u = await prisma.user.deleteMany({ where: { email: USER_EMAIL } });
  // Guest unlocks/payments cascade to null via onDelete: SetNull, so remove them
  // first, then the session.
  await prisma.cardUnlock.deleteMany({ where: { guestSessionId: GUEST_ID } });
  const g = await prisma.guestSession.deleteMany({ where: { id: GUEST_ID } });
  console.log(`Deleted ${u.count} demo user, ${g.count} demo guest session.`);
}

// ---------------------------------------------------------------------------
// Normal user with long-term history
// ---------------------------------------------------------------------------

async function seedUser(cardIds: string[]): Promise<void> {
  const passwordHash = await bcrypt.hash(USER_PASSWORD, 12);
  const createdAt = daysAgo(HISTORY_DAYS + 4, 8, 12); // account is a touch older than its history

  const base = {
    fullName: USER_NAME,
    passwordHash,
    role: "USER" as const,
    status: "ACTIVE" as const,
    emailVerifiedAt: daysAgo(HISTORY_DAYS + 4, 8, 30),
    consentTermsAt: createdAt,
    hasCompletedOnboarding: true,
    timezone: "America/New_York",
    locale: "en",
    lastLoginAt: daysAgo(0, 8, 5),
  };

  const user = await prisma.user.upsert({
    where: { email: USER_EMAIL },
    update: base,
    create: { email: USER_EMAIL, createdAt, ...base },
    select: { id: true },
  });
  const userId = user.id;

  // Preferences / notifications / PREMIUM subscription.
  await prisma.userPreference.upsert({
    where: { userId },
    update: { theme: "AUTO", tone: "MOTIVATIONAL", dailyCardAtHour: 8 },
    create: { userId, theme: "AUTO", tone: "MOTIVATIONAL", dailyCardAtHour: 8 },
  });
  await prisma.notificationPreference.upsert({
    where: { userId },
    update: { remindersEnabled: true, channel: "PUSH", weeklyNewsletter: true },
    create: { userId, remindersEnabled: true, channel: "PUSH", weeklyNewsletter: true },
  });
  await prisma.subscription.upsert({
    where: { userId },
    update: {
      tier: "PREMIUM",
      status: "ACTIVE",
      currentPeriodStart: daysAgo(20),
      currentPeriodEnd: daysAgo(-10),
    },
    create: {
      userId,
      tier: "PREMIUM",
      status: "ACTIVE",
      currentPeriodStart: daysAgo(20),
      currentPeriodEnd: daysAgo(-10),
      createdAt: daysAgo(HISTORY_DAYS - 5),
    },
  });

  // Wipe any previously generated history so re-runs stay clean.
  await prisma.$transaction([
    prisma.journalEntry.deleteMany({ where: { userId } }),
    prisma.moodCheckIn.deleteMany({ where: { userId } }),
    prisma.savedCard.deleteMany({ where: { userId } }),
    prisma.cardDraw.deleteMany({ where: { userId } }),
  ]);

  const hasCards = cardIds.length > 0;
  const sources = ["DAILY", "DECK_RANDOM", "SCHEDULED", "RANDOM"];

  // Walk the timeline. Most days get a mood check-in; ~every other day a draw;
  // roughly twice a week a journal entry; occasional saved card.
  let draws = 0;
  let moods = 0;
  let journals = 0;
  let saves = 0;
  const savedSeen = new Set<string>();

  for (let d = HISTORY_DAYS; d >= 0; d--) {
    const seed = HISTORY_DAYS - d;

    // Mood check-in on ~80% of days.
    if (seed % 5 !== 0) {
      const mood = pick(MOODS, seed * 3 + 1);
      const note = pick(MOOD_NOTES, seed * 2);
      const at = daysAgo(d, 8 + (seed % 3), (seed * 7) % 60);

      let linkedDrawId: string | null = null;
      let linkedCardId: string | null = null;

      // Every other day, a card draw — sometimes the mood links to it.
      if (hasCards && seed % 2 === 0) {
        const cardId = pick(cardIds, seed * 5 + 2);
        const draw = await prisma.cardDraw.create({
          data: {
            userId,
            cardId,
            source: pick(sources, seed),
            createdAt: at,
          },
          select: { id: true },
        });
        draws++;
        linkedDrawId = draw.id;
        linkedCardId = cardId;

        // Occasionally save the drawn card.
        if (seed % 4 === 0 && !savedSeen.has(cardId)) {
          await prisma.savedCard.create({
            data: { userId, cardId, savedGroupId: draw.id, createdAt: at },
          });
          savedSeen.add(cardId);
          saves++;
        }
      }

      const mc = await prisma.moodCheckIn.create({
        data: {
          userId,
          mood,
          note: note || null,
          linkedCardId,
          linkedDrawId,
          createdAt: at,
        },
        select: { id: true },
      });
      moods++;

      // ~twice a week, a journal entry — some tied to the mood check-in.
      if (seed % 3 === 0) {
        const body = pick(JOURNAL_BODIES, seed);
        await prisma.journalEntry.create({
          data: {
            userId,
            title: pick(JOURNAL_TITLES, seed * 2 + 1),
            bodyPlain: body,
            bodyHtml: `<p>${body}</p>`,
            moodCheckInId: seed % 6 === 0 ? mc.id : null,
            cardId: linkedCardId,
            isDraft: false,
            createdAt: at,
            updatedAt: at,
          },
        });
        journals++;
      }
    }
  }

  console.log(
    `\nDemo USER  ${USER_EMAIL}\n` +
      `  password : ${USER_PASSWORD}\n` +
      `  tier     : PREMIUM (ACTIVE)\n` +
      `  history  : ${moods} mood check-ins, ${draws} card draws, ` +
      `${journals} journal entries, ${saves} saved cards over ~${Math.round(HISTORY_DAYS / 30)} months`,
  );
}

// ---------------------------------------------------------------------------
// Resumable guest session
// ---------------------------------------------------------------------------

async function seedGuest(cardIds: string[]): Promise<void> {
  const cookieRaw = signGuestCookie(GUEST_ID);
  const cookieHash = sha256Hex(cookieRaw);
  const createdAt = daysAgo(40, 20, 15);
  const expiresAt = daysAgo(-90); // still valid for ~3 months.

  await prisma.guestSession.upsert({
    where: { id: GUEST_ID },
    update: { cookieHash, email: GUEST_EMAIL, expiresAt, claimedAt: null, claimedByUserId: null },
    create: {
      id: GUEST_ID,
      cookieHash,
      email: GUEST_EMAIL,
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15",
      createdAt,
      expiresAt,
    },
  });

  // A couple of successful card unlocks so the guest has paid history.
  await prisma.cardUnlock.deleteMany({ where: { guestSessionId: GUEST_ID } });
  let unlocks = 0;
  for (let i = 0; i < Math.min(2, cardIds.length); i++) {
    const at = daysAgo(35 - i * 9, 20, 30);
    await prisma.cardUnlock.create({
      data: {
        guestSessionId: GUEST_ID,
        cardId: cardIds[i]!,
        priceCents: 199,
        currency: "USD",
        status: "SUCCEEDED",
        unlockedAt: at,
        createdAt: at,
      },
    });
    unlocks++;
  }

  console.log(
    `\nDemo GUEST ${GUEST_EMAIL}\n` +
      `  unlocks     : ${unlocks} card(s) unlocked\n` +
      `  cookie name : soph_guest\n` +
      `  cookie value: ${cookieRaw}\n` +
      `  → In the browser devtools (Application ▸ Cookies), add a cookie named\n` +
      `    "soph_guest" with the value above for the site to resume this guest.`,
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  if (DELETE) {
    await removeAll();
    return;
  }

  const cards = await prisma.card.findMany({
    where: { isActive: true },
    select: { id: true },
    orderBy: { sortOrder: "asc" },
    take: 60,
  });
  const cardIds = cards.map((c) => c.id);
  if (cardIds.length === 0) {
    console.warn("No active cards found — creating accounts without card-linked history.");
  }

  await seedUser(cardIds);
  await seedGuest(cardIds);

  console.log("\nDone.");
}

main()
  .catch((err) => {
    console.error("create-test-accounts failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
