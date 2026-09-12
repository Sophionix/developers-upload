import bcrypt from "bcryptjs";
import Stripe from "stripe";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../src/generated/prisma/client";
import { resolveDatabaseConnectionConfig } from "../scripts/database-config.mjs";

function buildClient(): PrismaClient {
  const config = resolveDatabaseConnectionConfig(process.env);
  const adapter = new PrismaMariaDb({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    connectionLimit: 5,
  });
  return new PrismaClient({ adapter });
}

const prisma = buildClient();

async function seedDecks() {
  const decks = [
    {
      slug: "mindfulness",
      title: "Mindfulness",
      description: "Presence, breath, awareness.",
      sortOrder: 1,
    },
    {
      slug: "confidence",
      title: "Confidence",
      description: "Self-worth and courage.",
      sortOrder: 2,
    },
    {
      slug: "relationships",
      title: "Relationships",
      description: "Connection, empathy, boundaries.",
      sortOrder: 3,
    },
  ];
  for (const d of decks) {
    await prisma.deck.upsert({
      where: { slug: d.slug },
      update: {
        title: d.title,
        description: d.description,
        sortOrder: d.sortOrder,
      },
      create: d,
    });
  }
}

async function seedThemes() {
  const themes = [
    { slug: "breath", name: "Breath" },
    { slug: "gratitude", name: "Gratitude" },
    { slug: "self-love", name: "Self Love" },
    { slug: "courage", name: "Courage" },
    { slug: "boundaries", name: "Boundaries" },
    { slug: "forgiveness", name: "Forgiveness" },
  ];
  for (const t of themes) {
    await prisma.theme.upsert({
      where: { slug: t.slug },
      update: { name: t.name },
      create: t,
    });
  }
}

async function seedCategories() {
  const cats = [
    { slug: "reflection", name: "Reflection" },
    { slug: "morning", name: "Morning" },
    { slug: "evening", name: "Evening" },
    { slug: "growth", name: "Growth" },
  ];
  for (const c of cats) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name },
      create: c,
    });
  }
}

async function seedTags() {
  const tags = [
    { slug: "calm", name: "Calm" },
    { slug: "anxious", name: "Anxious" },
    { slug: "grateful", name: "Grateful" },
    { slug: "hopeful", name: "Hopeful" },
    { slug: "work", name: "Work" },
    { slug: "family", name: "Family" },
    { slug: "self", name: "Self" },
    { slug: "love", name: "Love" },
    { slug: "growth", name: "Growth" },
    { slug: "healing", name: "Healing" },
  ];
  for (const t of tags) {
    await prisma.tag.upsert({
      where: { slug: t.slug },
      update: { name: t.name },
      create: t,
    });
  }
}

async function seedCards() {
  const byDeck = async (slug: string) => {
    const d = await prisma.deck.findUniqueOrThrow({ where: { slug } });
    return d.id;
  };
  const mindfulness = await byDeck("mindfulness");
  const confidence = await byDeck("confidence");
  const relationships = await byDeck("relationships");

  const cards: Array<{
    slug: string;
    deckId: string;
    title: string;
    message: string;
    prompt: string;
    accessType: "FREE" | "PREMIUM";
    guestPreview: boolean;
    sortOrder: number;
  }> = [
    {
      slug: "m-1",
      deckId: mindfulness,
      title: "Breath as Anchor",
      message: "Return to the breath. It is always here.",
      prompt: "What pulled you away from the present today?",
      accessType: "FREE",
      guestPreview: true,
      sortOrder: 1,
    },
    {
      slug: "m-2",
      deckId: mindfulness,
      title: "This Moment",
      message: "The present is the only place life happens.",
      prompt: "Name three things you can sense right now.",
      accessType: "FREE",
      guestPreview: false,
      sortOrder: 2,
    },
    {
      slug: "m-3",
      deckId: mindfulness,
      title: "Soft Attention",
      message: "Notice without judging.",
      prompt: "What are you noticing without trying to fix?",
      accessType: "PREMIUM",
      guestPreview: true,
      sortOrder: 3,
    },
    {
      slug: "m-4",
      deckId: mindfulness,
      title: "Ground Beneath",
      message: "You are held by the earth, always.",
      prompt: "Where do you feel most grounded?",
      accessType: "PREMIUM",
      guestPreview: false,
      sortOrder: 4,
    },
    {
      slug: "c-1",
      deckId: confidence,
      title: "You Are Enough",
      message: "Worthiness is your birthright.",
      prompt: "What would you do if you believed you were enough?",
      accessType: "FREE",
      guestPreview: true,
      sortOrder: 1,
    },
    {
      slug: "c-2",
      deckId: confidence,
      title: "Small Brave Things",
      message: "Courage is built one step at a time.",
      prompt: "Name a small brave thing you did recently.",
      accessType: "FREE",
      guestPreview: false,
      sortOrder: 2,
    },
    {
      slug: "c-3",
      deckId: confidence,
      title: "Own Your Voice",
      message: "Your voice matters, exactly as it is.",
      prompt: "Where do you hold back your voice?",
      accessType: "PREMIUM",
      guestPreview: true,
      sortOrder: 3,
    },
    {
      slug: "c-4",
      deckId: confidence,
      title: "Standing Tall",
      message: "Let your posture match your strength.",
      prompt: "What does confidence feel like in your body?",
      accessType: "PREMIUM",
      guestPreview: false,
      sortOrder: 4,
    },
    {
      slug: "r-1",
      deckId: relationships,
      title: "Listen First",
      message: "Presence is the deepest gift.",
      prompt: "Who needs your listening today?",
      accessType: "FREE",
      guestPreview: true,
      sortOrder: 1,
    },
    {
      slug: "r-2",
      deckId: relationships,
      title: "Boundaries Are Love",
      message: "Saying no makes your yes meaningful.",
      prompt: "Where do you need a clearer boundary?",
      accessType: "FREE",
      guestPreview: false,
      sortOrder: 2,
    },
    {
      slug: "r-3",
      deckId: relationships,
      title: "Repair Is Possible",
      message: "Rupture is not the end.",
      prompt: "What relationship needs a small repair?",
      accessType: "PREMIUM",
      guestPreview: true,
      sortOrder: 3,
    },
    {
      slug: "r-4",
      deckId: relationships,
      title: "Be Witnessed",
      message: "Let yourself be seen.",
      prompt: "Who sees you clearly? How does it feel?",
      accessType: "PREMIUM",
      guestPreview: false,
      sortOrder: 4,
    },
  ];

  for (const c of cards) {
    const { slug, ...rest } = c;
    const existing = await prisma.card.findFirst({
      where: { deckId: rest.deckId, title: rest.title },
    });
    if (existing) {
      await prisma.card.update({ where: { id: existing.id }, data: rest });
    } else {
      await prisma.card.create({ data: rest });
    }
    void slug;
  }
}

async function seedJourney() {
  const journey = await prisma.journey.upsert({
    where: { slug: "seven-day-reset" },
    update: {},
    create: {
      slug: "seven-day-reset",
      title: "Seven-Day Reset",
      description: "A week to come back to yourself.",
      durationDays: 7,
      accessType: "FREE",
    },
  });

  const cards = await prisma.card.findMany({
    take: 7,
    orderBy: { createdAt: "asc" },
  });
  for (let i = 0; i < 7; i++) {
    const card = cards[i];
    await prisma.journeyDay.upsert({
      where: { journeyId_dayIndex: { journeyId: journey.id, dayIndex: i + 1 } },
      update: {
        cardId: card?.id ?? null,
        promptText: `Day ${i + 1}: take a slow breath and answer honestly.`,
        quote: "The quieter you become, the more you can hear.",
      },
      create: {
        journeyId: journey.id,
        dayIndex: i + 1,
        cardId: card?.id ?? null,
        promptText: `Day ${i + 1}: take a slow breath and answer honestly.`,
        quote: "The quieter you become, the more you can hear.",
      },
    });
  }
}

async function seedSettings() {
  const rows: Array<{ key: string; value: unknown }> = [
    { key: "guest_login_enabled", value: true },
    { key: "card_unlock_price_cents", value: 199 },
    { key: "app_name", value: "Sophionix" },
  ];
  for (const r of rows) {
    await prisma.systemSetting.upsert({
      where: { key: r.key },
      update: { value: r.value as never },
      create: { key: r.key, value: r.value as never },
    });
  }
}

async function seedPlan() {
  await prisma.pricingPlan.upsert({
    where: { slug: "premium-monthly" },
    update: {},
    create: {
      slug: "premium-monthly",
      name: "Premium Monthly",
      description:
        "Sophionix Premium — unlimited access to every affirmation card and guided journey, voice journaling, and data exports. Renews monthly. Cancel anytime.",
      priceCents: 999,
      currency: "USD",
      intervalMonths: 1,
      trialDays: 7,
      features: [
        "all_cards",
        "all_journeys",
        "voice_notes",
        "exports",
      ] as never,
      visibility: "PUBLIC",
      isActive: false,
    },
  });
  await prisma.pricingPlan.upsert({
    where: { slug: "premium-yearly" },
    update: {},
    create: {
      slug: "premium-yearly",
      name: "Premium",
      description:
        "Sophionix Premium — unlimited access to every affirmation card and guided journey, voice journaling, and data exports. Renews yearly. Cancel anytime.",
      priceCents: 999,
      currency: "USD",
      intervalMonths: 12,
      trialDays: 7,
      features: [
        "all_cards",
        "all_journeys",
        "voice_notes",
        "exports",
      ] as never,
      visibility: "PUBLIC",
    },
  });
}

async function seedTemplates() {
  const templates: Array<{
    slug: string;
    type: "EMAIL" | "PUSH";
    subject?: string;
    title?: string;
    body: string;
    variables: string[];
  }> = [
    {
      slug: "welcome",
      type: "EMAIL",
      subject: "Welcome to Sophionix, {{fullName}}",
      body: "Hi {{fullName}}, welcome aboard.",
      variables: ["fullName"],
    },
    {
      slug: "verify_email",
      type: "EMAIL",
      subject: "Verify your Sophionix account",
      body: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Verify your email</title></head>
<body style="margin:0;padding:0;background:#000000;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#000000;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <!-- Logo / brand header -->
        <tr>
          <td align="center" style="padding-bottom:32px;">
            <div style="display:inline-block;background:linear-gradient(37.7deg,#c87a02 21%,#210102 86%);border-radius:16px;padding:14px 28px;">
              <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:1px;">SOPHIONIX</span>
            </div>
          </td>
        </tr>
        <!-- Card -->
        <tr>
          <td style="background:rgba(26,1,1,0.95);border:1px solid rgba(255,255,255,0.12);border-radius:21px;padding:48px 40px;">
            <h1 style="margin:0 0 8px;font-size:26px;font-weight:700;color:#ffffff;text-align:center;">Verify your email</h1>
            <p style="margin:0 0 32px;font-size:15px;color:rgba(255,255,255,0.65);text-align:center;line-height:1.6;">
              Enter the code below to verify your email address and activate your Sophionix account.
            </p>
            <!-- OTP code -->
            <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding-bottom:32px;">
              <div style="display:inline-block;background:linear-gradient(37.7deg,#c87a02 21%,#210102 86%);border-radius:16px;padding:3px;">
                <div style="background:#0a0505;border-radius:13px;padding:20px 48px;">
                  <span style="font-size:40px;font-weight:700;color:#ffffff;letter-spacing:12px;">{{otp}}</span>
                </div>
              </div>
            </td></tr></table>
            <!-- Notice -->
            <table width="100%" cellpadding="0" cellspacing="0"><tr>
              <td style="background:rgba(229,88,5,0.12);border:1px solid rgba(229,88,5,0.3);border-radius:12px;padding:14px 18px;">
                <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.7);text-align:center;">
                  ⏱ Expires in <strong style="color:#E55805;">24 hours</strong> &nbsp;·&nbsp; Do not share this code with anyone
                </p>
              </td>
            </tr></table>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td align="center" style="padding-top:24px;">
            <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.3);line-height:1.6;">
              This code expires in 24 hours. If you didn't create a Sophionix account, you can safely ignore this email.<br>
              &copy; Sophionix. All rights reserved.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
      variables: ["otp"],
    },
    {
      slug: "reset_password",
      type: "EMAIL",
      subject: "Reset your Sophionix password",
      body: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reset your password</title></head>
<body style="margin:0;padding:0;background:#000000;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#000000;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <tr>
          <td align="center" style="padding-bottom:32px;">
            <div style="display:inline-block;background:linear-gradient(37.7deg,#c87a02 21%,#210102 86%);border-radius:16px;padding:14px 28px;">
              <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:1px;">SOPHIONIX</span>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background:rgba(26,1,1,0.95);border:1px solid rgba(255,255,255,0.12);border-radius:21px;padding:48px 40px;">
            <h1 style="margin:0 0 8px;font-size:26px;font-weight:700;color:#ffffff;text-align:center;">Reset your password</h1>
            <p style="margin:0 0 32px;font-size:15px;color:rgba(255,255,255,0.65);text-align:center;line-height:1.6;">
              Use the code below to reset your password.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding-bottom:32px;">
              <div style="display:inline-block;background:linear-gradient(37.7deg,#c87a02 21%,#210102 86%);border-radius:16px;padding:3px;">
                <div style="background:#0a0505;border-radius:13px;padding:20px 48px;">
                  <span style="font-size:40px;font-weight:700;color:#ffffff;letter-spacing:12px;">{{otp}}</span>
                </div>
              </div>
            </td></tr></table>
            <table width="100%" cellpadding="0" cellspacing="0"><tr>
              <td style="background:rgba(229,88,5,0.12);border:1px solid rgba(229,88,5,0.3);border-radius:12px;padding:14px 18px;">
                <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.7);text-align:center;">
                  ⏱ Expires in <strong style="color:#E55805;">60 minutes</strong> &nbsp;·&nbsp; Do not share this code with anyone
                </p>
              </td>
            </tr></table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding-top:24px;">
            <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.3);line-height:1.6;">
              If you didn't request a password reset, you can safely ignore this email.<br>
              &copy; Sophionix. All rights reserved.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
      variables: ["otp"],
    },
    {
      slug: "weekly_newsletter",
      type: "EMAIL",
      subject: "Your week in reflection",
      body: "Hi {{fullName}}, here's your weekly roundup.",
      variables: ["fullName"],
    },
    {
      slug: "admin_reset_password",
      type: "EMAIL",
      subject: "Admin password reset",
      body: "Use this link to reset your admin password (expires in 30 minutes): {{resetUrl}}",
      variables: ["resetUrl"],
    },
    {
      slug: "admin_invite",
      type: "EMAIL",
      subject: "You've been invited to Sophionix Admin",
      body: "Hi {{fullName}}, you've been invited as {{role}}. Set up your account: {{inviteUrl}}",
      variables: ["fullName", "role", "inviteUrl"],
    },
    {
      slug: "admin-2fa-otp",
      type: "EMAIL",
      subject: "Your Sophionix admin verification code",
      body: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Admin verification code</title></head>
<body style="margin:0;padding:0;background:#000000;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#000000;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <!-- Logo / brand header -->
        <tr>
          <td align="center" style="padding-bottom:32px;">
            <div style="display:inline-block;background:linear-gradient(37.7deg,#c87a02 21%,#210102 86%);border-radius:16px;padding:14px 28px;">
              <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:1px;">SOPHIONIX</span>
            </div>
          </td>
        </tr>
        <!-- Card -->
        <tr>
          <td style="background:rgba(26,1,1,0.95);border:1px solid rgba(255,255,255,0.12);border-radius:21px;padding:48px 40px;">
            <h1 style="margin:0 0 8px;font-size:26px;font-weight:700;color:#ffffff;text-align:center;">Admin Verification Code</h1>
            <p style="margin:0 0 32px;font-size:15px;color:rgba(255,255,255,0.65);text-align:center;line-height:1.6;">
              Use the code below to complete your two-factor authentication.
            </p>
            <!-- OTP display -->
            <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding-bottom:32px;">
              <div style="display:inline-block;background:linear-gradient(37.7deg,#c87a02 21%,#210102 86%);border-radius:16px;padding:3px;">
                <div style="background:#0a0505;border-radius:13px;padding:20px 48px;">
                  <span style="font-size:40px;font-weight:700;color:#ffffff;letter-spacing:12px;">{{otp}}</span>
                </div>
              </div>
            </td></tr></table>
            <!-- Warning box -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:0;"><tr>
              <td style="background:rgba(229,88,5,0.12);border:1px solid rgba(229,88,5,0.3);border-radius:12px;padding:14px 18px;">
                <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.7);text-align:center;">
                  ⏱ Expires in <strong style="color:#E55805;">10 minutes</strong> &nbsp;·&nbsp; Do not share this code with anyone
                </p>
              </td>
            </tr></table>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td align="center" style="padding-top:24px;">
            <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.3);line-height:1.6;">
              If you didn't attempt to sign in to Sophionix Admin, please secure your account immediately.<br>
              &copy; Sophionix. All rights reserved.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
      variables: ["otp"],
    },
  ];
  for (const t of templates) {
    const data = {
      type: t.type,
      subject: t.subject ?? null,
      title: t.title ?? null,
      body: t.body,
      variables: t.variables as never,
    };
    await prisma.notificationTemplate.upsert({
      where: { slug: t.slug },
      update: data,
      create: { slug: t.slug, ...data },
    });
  }
}

async function seedSuperAdmin() {
  const email = process.env.SEED_SUPER_ADMIN_EMAIL;
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD;
  if (!email || !password) return;
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.upsert({
    where: { email },
    update: { role: "SUPER_ADMIN", passwordHash, emailVerifiedAt: new Date() },
    create: {
      email,
      passwordHash,
      fullName: "Super Admin",
      role: "SUPER_ADMIN",
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
      hasCompletedOnboarding: true,
    },
  });
}

async function syncPlansToStripe() {
  const sk = process.env.STRIPE_SECRET_KEY;
  if (!sk || /CHANGE_ME|placeholder/i.test(sk)) {
    console.log("seed: skipping Stripe sync (no secret key)");
    return;
  }
  const apiVersion = (process.env.STRIPE_API_VERSION ?? "2024-12-18.acacia") as Stripe.StripeConfig["apiVersion"];
  const stripe = new Stripe(sk, { apiVersion });

  const plans = await prisma.pricingPlan.findMany({
    where: { isActive: true },
  });

  for (const plan of plans) {
    let productId = plan.stripeProductId;

    if (!productId) {
      const found = await stripe.products.search({
        query: `metadata["planId"]:"${plan.id}"`,
      });
      if (found.data.length > 0) {
        productId = found.data[0]!.id;
      } else {
        const product = await stripe.products.create({
          name: plan.name,
          active: plan.isActive,
          metadata: { planId: plan.id },
          ...(plan.description ? { description: plan.description } : {}),
        });
        productId = product.id;
      }
    }

    let priceId = plan.stripePriceId;
    if (!priceId) {
      const prices = await stripe.prices.list({
        product: productId,
        active: true,
        limit: 1,
      });
      if (prices.data.length > 0) {
        priceId = prices.data[0]!.id;
      } else {
        const interval = plan.intervalMonths === 12 ? "year" as const : "month" as const;
        const intervalCount = plan.intervalMonths === 12 ? 1 : plan.intervalMonths;
        const price = await stripe.prices.create({
          product: productId,
          unit_amount: plan.priceCents,
          currency: plan.currency.toLowerCase(),
          recurring: { interval, interval_count: intervalCount },
          metadata: { planId: plan.id },
        });
        priceId = price.id;
      }
    }

    await prisma.pricingPlan.update({
      where: { id: plan.id },
      data: { stripeProductId: productId, stripePriceId: priceId },
    });
    console.log(`seed: synced plan "${plan.slug}" → product=${productId} price=${priceId}`);
  }
}

// ---------------------------------------------------------------------------
// Analytics seed data — populates charts on admin analytics page
// ---------------------------------------------------------------------------

function dayDate(daysAgo: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function seedDailyPlatformStats() {
  const moods = ["happy", "sad", "anxious", "calm", "neutral"] as const;
  for (let i = 30; i >= 0; i--) {
    const date = dayDate(i);
    const base = 31 - i;
    const dau = rand(40, 60) + base * 2;
    const wau = Math.round(dau * rand(28, 35) / 10);
    const mau = Math.round(wau * rand(22, 28) / 10);
    const moodDist: Record<string, number> = {};
    for (const m of moods) moodDist[m] = rand(3, 25);

    await prisma.dailyPlatformStat.upsert({
      where: { date },
      update: {},
      create: {
        date,
        newSignups: rand(2, 12),
        dau,
        wau,
        mau,
        draws: rand(50, 200) + base * 3,
        entries: rand(20, 80) + base,
        paidConversions: rand(0, 4),
        revenueCents: rand(0, 4) * 999,
        churnCount: rand(0, 2),
        moodDistribution: moodDist,
      },
    });
  }
}

async function seedCardUsageStats() {
  const cards = await prisma.card.findMany({ select: { id: true }, take: 12 });
  if (cards.length === 0) return;
  for (let i = 30; i >= 0; i--) {
    const date = dayDate(i);
    for (const card of cards) {
      await prisma.cardUsageStat.upsert({
        where: { date_cardId: { date, cardId: card.id } },
        update: {},
        create: {
          date,
          cardId: card.id,
          draws: rand(2, 30),
          saves: rand(0, 10),
          unlocks: rand(0, 5),
        },
      });
    }
  }
}

async function seedRetentionCohorts() {
  for (let m = 5; m >= 0; m--) {
    const cohortDate = new Date();
    cohortDate.setUTCMonth(cohortDate.getUTCMonth() - m);
    cohortDate.setUTCDate(1);
    cohortDate.setUTCHours(0, 0, 0, 0);
    const size = rand(40, 120);
    let retained = size;
    for (const offset of [0, 1, 3, 7, 14, 30]) {
      retained = offset === 0 ? size : Math.max(1, Math.round(retained * (rand(60, 90) / 100)));
      await prisma.retentionCohort.upsert({
        where: { cohortDate_dayOffset: { cohortDate, dayOffset: offset } },
        update: {},
        create: { cohortDate, dayOffset: offset, size, retained },
      });
    }
  }
}

async function seedSophionixCards() {
  const deck = await prisma.deck.upsert({
    where: { slug: "sophionix-keys" },
    update: {
      title: "Sophionix Keys",
      description: "37 healing keys for spiritual growth, inner guidance, and soul evolution.",
      sortOrder: 0,
    },
    create: {
      slug: "sophionix-keys",
      title: "Sophionix Keys",
      description: "37 healing keys for spiritual growth, inner guidance, and soul evolution.",
      sortOrder: 0,
    },
  });

  const cards: Array<{
    title: string;
    message: string;
    prompt: string;
    imageUrl: string;
    sortOrder: number;
    accessType: "FREE" | "PREMIUM";
    guestPreview: boolean;
  }> = [
    {
      title: "Planetary Influence",
      message:
        "The energies of celestial bodies surround us at all times. By making the choice to work with these planetary influences, we empower ourselves to navigate our personal journeys with greater harmony and purpose. Each major celestial body offers unique forms of energetic guidance — from the Sun's insight into your identity, to the Moon's influence on emotions, to Saturn's encouragement of focus. Visualize having a one-to-one with a cosmic friend when asking for assistance, not a distant rock in the sky.",
      prompt: "Which celestial body's energy are you most drawn to right now, and why?",
      imageUrl: "/cards/01-planetary-influence.png",
      sortOrder: 1,
      accessType: "FREE",
      guestPreview: true,
    },
    {
      title: "Telescope",
      message:
        "Sometimes we simply don't have all the answers, and we must trust that the Source has placed something in our path for a reason. If we don't understand the situation, it's perfectly fine to send it back and ask for clarification. Picture your problem floating through the porthole in the center of the Telescope toward the light of Source to be cleansed of confusion and returned reconfigured for better understanding. Source truly appreciates when you ask and connect, and the answers you need will always find their way to you.",
      prompt: "What in your life needs to be sent to the light for clarity right now?",
      imageUrl: "/cards/02-telescope.png",
      sortOrder: 2,
      accessType: "FREE",
      guestPreview: true,
    },
    {
      title: "Humor",
      message:
        "Humor is the key of lightening up. When on the path of spiritual development, we can forget that laughing at ourselves is a necessary part of the larger act. In this world play, it's okay to crack up on stage and have the audience laugh with you — in fact, it's required from time to time. Spirituality is a serious thing; a good chuckle at the human condition is part of the process of equilibrium.",
      prompt: "What heavy load could you lighten with a moment of genuine self-compassion and humor?",
      imageUrl: "/cards/03-humor.png",
      sortOrder: 3,
      accessType: "FREE",
      guestPreview: false,
    },
    {
      title: "Window Pane",
      message:
        "Window Pane is the key of revealing the soul — the portal through which your inner truth steps into the outer world. It takes courage to let your true self be witnessed without filters or masks, but in doing so you honor your connection to Source. When you allow your soul to shine outward through your eyes, you invite others to recognize their own light by reflecting back to them their truths. You become a beacon showing that authenticity is strength and vulnerability is power.",
      prompt: "What part of your true self have you been hiding that is ready to be seen?",
      imageUrl: "/cards/04-window-pane.png",
      sortOrder: 4,
      accessType: "FREE",
      guestPreview: false,
    },
    {
      title: "Halo",
      message:
        "Opening your mind means loosening your grip on what you think you already understand — the willingness to release rigid ideas and let fresh inspiration flow in. When you allow new thoughts to move through you rather than fixating on them, this is the beginning of true mental expansion. Give yourself permission to explore the things you've always been interested in, without fear of judgment or ridicule. Curiosity is a doorway for growth, and every new experience brings you closer to the fullest version of yourself.",
      prompt: "What idea or curiosity have you been too afraid to explore?",
      imageUrl: "/cards/05-halo.png",
      sortOrder: 5,
      accessType: "FREE",
      guestPreview: false,
    },
    {
      title: "Readiness",
      message:
        "You are entering a new way of walking in the world — one empowered by your deep connection to both the Father God and the Mother Goddess. The Father offers clarity, prosperity, and protection; the Mother offers nurturing, intuition, and support. This is your moment of rebirth, and the identities you once carried belonged to an outdated version of you. Move forward with open arms: with this divine balance as your foundation, you are ready, unshaken, unapologetic, and fully aligned to rise into who you were always meant to be.",
      prompt: "In what area of your life do you feel ready to step into a new version of yourself?",
      imageUrl: "/cards/06-readiness.png",
      sortOrder: 6,
      accessType: "FREE",
      guestPreview: true,
    },
    {
      title: "Quilt",
      message:
        "In times of difficulty, the image of a Quilt provides a sense of relief and reassurance. The protective Quilt serves as energetic insulation — like the generous, all-encompassing hug of The Great Mother. Your Guardian Angel is watching over you with unconditional love and fierce compassion; you are never truly alone. The entire Universe, including loved ones who have passed on, surrounds you with protection and guidance at all times.",
      prompt: "Where do you need to ask for support and let yourself truly be held?",
      imageUrl: "/cards/07-quilt.png",
      sortOrder: 7,
      accessType: "FREE",
      guestPreview: false,
    },
    {
      title: "Concentration",
      message:
        "Concentration becomes difficult when you're stressed or overwhelmed, making even simple tasks feel impossible because your mind can't maintain its natural, fluid rhythm. This is the moment to pause, breathe, and come back to center. Focus on the center of this image and notice what your perception does — are you moving through it, or is it moving toward you? Relax and let the visual flow, mirroring the natural undulation of your body's electrical impulses, and allow your focus to steady and restore.",
      prompt: "What is pulling your focus right now — toward something, or away from it?",
      imageUrl: "/cards/08-concentration.png",
      sortOrder: 8,
      accessType: "FREE",
      guestPreview: false,
    },
    {
      title: "Arachnid",
      message:
        "Arachnid is the key of recognizing emotional trauma patterns — echoes of generations of emotional imprints, beliefs, and survival mechanisms passed from one lineage to the next. Like a spider weaving its web, we create intricate patterns in our lives, often without realizing we are repeating the same design. Awareness is the first step to liberation; once you can see the pattern's origin clearly, you gain the power to transform it. In that moment, you shift from being caught in the web to becoming the conscious weaver of your own reality.",
      prompt: "What emotional pattern have you noticed repeating in your life?",
      imageUrl: "/cards/09-arachnid.png",
      sortOrder: 9,
      accessType: "FREE",
      guestPreview: false,
    },
    {
      title: "Surrender Flag",
      message:
        "This is a key of humbly backing down. When faced with unpredictable outcomes, it is important to metaphorically raise your white flag and surrender to whatever the situation may bring, enabling assistance to flow through rather than meeting resistance. Letting go of the desire to control an outcome requires true bravery. Trust that the divine can see in all directions and far into the future, and believe that everything will fall into perfect order.",
      prompt: "What are you gripping tightly that might be better surrendered to something greater?",
      imageUrl: "/cards/10-surrender-flag.png",
      sortOrder: 10,
      accessType: "FREE",
      guestPreview: false,
    },
    {
      title: "Neatness",
      message:
        "Neatness is the art of aligning your goals, dreams, and wishes so they form a clear, unified path toward your higher living. In a world shaped by thought energy, scattered intentions create scattered results in the physical realm. Neatness invites you to bring your inner world into harmony, lining up your aspirations so they support each other rather than compete. By keeping your inner priorities clear and tidy, you create a powerful energetic stream that naturally carries you forward toward your intended reality.",
      prompt: "What one intention, if clarified, would bring the most harmony to your life right now?",
      imageUrl: "/cards/11-neatness.png",
      sortOrder: 11,
      accessType: "FREE",
      guestPreview: false,
    },
    {
      title: "Nightwing",
      message:
        "Nightwing is the key of inner navigation through darkness — a symbol that teaches you to ground and center yourself during times of challenge or crisis. Like a bat that uses sonar to fly through the night, you too have a deep inner sensing that can guide you safely when nothing around you seems clear. In moments of fear or overwhelm, fly inward instead of away — retreat into your inner cave where the Divine Mother awaits your arrival, where darkness is your ally. Close your eyes, breathe deeply, and listen not for sound, but for the silence beneath it.",
      prompt: "What truth is waiting in the silence that you have been avoiding?",
      imageUrl: "/cards/12-nightwing.png",
      sortOrder: 12,
      accessType: "FREE",
      guestPreview: false,
    },
    {
      title: "Gods Eye",
      message:
        "There are moments when the Divine falls completely silent, and these periods can be deeply unsettling — triggering old fears of abandonment and betrayal. But this silence isn't punishment; it's a test of your inner mettle. What feels like spiritual withdrawal is often the moment when your inner strength is being activated. Trust is what carries you across the empty spaces where certainty used to live; you are not actually alone, simply being given room to step into your own capacity.",
      prompt: "Where in your life are you being called to trust without waiting for external confirmation?",
      imageUrl: "/cards/13-gods-eye.png",
      sortOrder: 13,
      accessType: "FREE",
      guestPreview: true,
    },
    {
      title: "Elevator",
      message:
        "Elevator is a key of perspective — understanding that achieving true clarity sometimes requires stepping beyond the limitations of physical existence. By temporarily releasing your consciousness from your earthly presence through meditation, you can access insights otherwise out of reach. Allow your spirit to gently rise and observe your physical form from a distance, remembering that you are a spiritual being having a human experience. Ask why a spiritual being like you is needed here on Earth at this time, and invite your guides to reveal your soul's mission.",
      prompt: "From a higher perspective, what is your soul's purpose in your current situation?",
      imageUrl: "/cards/14-elevator.png",
      sortOrder: 14,
      accessType: "FREE",
      guestPreview: false,
    },
    {
      title: "Three Phases of the Moon",
      message:
        "Honoring the energy of the lunar phases — new, quarters, and full — involves consciously adapting to the moon's changing cycles. The New Moon is a time of pure potential and new beginnings; the Waxing Moon calls for forward action; the Full Moon marks celebration and fulfillment; and the Waning Moon invites release and letting go. By intentionally aligning with these rhythms rather than resisting them, we foster harmony, balance, and greater control over our daily lives. Try incorporating these cycles into your life and see if going with the flow serves you better than fighting against it.",
      prompt: "What phase of the lunar cycle mirrors where you are in your life right now?",
      imageUrl: "/cards/15-three-phases-of-the-moon.png",
      sortOrder: 15,
      accessType: "FREE",
      guestPreview: false,
    },
    {
      title: "Bear Hug",
      message:
        "The Bear Hug key lightens a heavy load. When we are deep in healing and no person is available to hold us, the Universe gives hugs too — picture it extending its energetic arms, inviting you in, and letting you fall all in, knowing it is safe. Your past loved ones and pets are also accessible; you do not need to label yourself a medium to feel their presence, as they are right there supporting you the whole way. Fear is the only thing holding you back from connecting freely, so don't go without — ask for that Bear Hug.",
      prompt: "What connection — seen or unseen — could you lean into for support today?",
      imageUrl: "/cards/16-bear-hug.png",
      sortOrder: 16,
      accessType: "FREE",
      guestPreview: false,
    },
    {
      title: "Doorway",
      message:
        "Entering Goddess is a key that signifies an invitation into a realm governed by symbols — she invites you to learn her language, but you must be very quiet and still to do so. By accepting this invitation, you gain extra guidance that aids in your ongoing development, offering a glimpse of what's going on around you by looking at the symbolic world that interplays within the physical one. Noticing messages within number sequences, music lyrics, animal totems, plants, movies, clouds, and dreams opens you to her wealth of information. She is waiting to help if you are willing to look, listen, and believe.",
      prompt: "What symbol or sign from the universe have you been noticing lately?",
      imageUrl: "/cards/17-doorway.png",
      sortOrder: 17,
      accessType: "FREE",
      guestPreview: false,
    },
    {
      title: "Church Steeple",
      message:
        "The Inner Compass functions as a sensitive receiver that corresponds to the chakras in the palms of your hands, enabling you to sense imbalances and channel healing energy. When long-standing health issues aren't fully recognized as frequencies, their effects can persist in the body for years. This doesn't mean you should delay or avoid seeing your doctor — professional care is essential. But you can also support your own healing by beginning the journey of understanding how your mind, body, emotions, and energy work together to create disease, or dissolve it.",
      prompt: "What area of your body or life is asking for healing attention right now?",
      imageUrl: "/cards/18-church-steeple.png",
      sortOrder: 18,
      accessType: "FREE",
      guestPreview: false,
    },
    {
      title: "Caution",
      message:
        "In unstable situations, impulsive action can threaten both your inner peace and your physical safety, which is why blending spiritual wisdom with practical knowledge is crucial. Your inner wisdom understands when silence offers more safety than confrontation, and when thoughtful planning is wiser than immediate reaction. From a spiritual perspective, boundary-setting becomes an act of sacred self-preservation — protecting your inner light and outer body from harm. By honoring both spiritual guidance and real-world caution, you protect your well-being and build healthy boundaries that guide you toward freedom with strength and grace.",
      prompt: "Where do you need to move with more care and intention before acting?",
      imageUrl: "/cards/19-caution.png",
      sortOrder: 19,
      accessType: "FREE",
      guestPreview: false,
    },
    {
      title: "Stop Sign",
      message:
        "There are times when you feel overwhelmed and need both time and space. Creating this distance is crucial, as it allows you to regroup and recharge — sometimes you need everything to simply stop, granting you a moment to collect your thoughts and regain your composure. Allow yourself this moment to release the demands of the outside world and return to the sanctuary within. Honor the wisdom that led you here, forgive yourself for not pausing sooner, and let yourself become attuned once again to what feeds you, not what drains you.",
      prompt: "What do you need to pause, decline, or set aside to restore your well-being?",
      imageUrl: "/cards/20-stop.png",
      sortOrder: 20,
      accessType: "FREE",
      guestPreview: false,
    },
    {
      title: "Stairway",
      message:
        "Stairway invites you to rise above your situation to get a clear view of what's really happening. When we face a challenge that needs a clear perspective, the best way to understand it is to get far away from it and then return with a fresher approach. Ascension — whether of your soul, thoughts, or emotions — clears you from staying stuck in repetitive patterns; you can only solve a problem if you step back and away from it. Like the Phoenix rising from its own ashes, it may be time for you to rise anew, leaving behind the past and embracing a fresh start.",
      prompt: "What challenge would look entirely different if you viewed it from a much higher perspective?",
      imageUrl: "/cards/21-stairway.png",
      sortOrder: 21,
      accessType: "FREE",
      guestPreview: false,
    },
    {
      title: "Third Eye",
      message:
        "Third Eye is the key of intuition — the inner lens that perceives what lies beneath the surface of any issue. To open the Third Eye, the mind and body must be grounded and still enough to receive its subtle visions and impressions. When an opening occurs, your inner vision expands dramatically, and you can see or sense everything around you and within your field. With regular practice, this intuitive gateway becomes clearer and more responsive — a powerful portal to wisdom not yet consciously known.",
      prompt: "What does your intuition know that your rational mind is not yet accepting?",
      imageUrl: "/cards/22-third-eye.png",
      sortOrder: 22,
      accessType: "FREE",
      guestPreview: false,
    },
    {
      title: "Male",
      message:
        "The Male key is to allow the Feminine into your physical spaces. To truly embody the feminine, recognize her within your psyche and display her presence outwardly — through small tokens, charms, an altar, or weaving her influence into daily routines like cooking organic foods, gardening, or creating with natural elements. While masculine representations are abundant, consciously making the invisible feminine energy visible is a profound act of respect. Balance of the masculine and feminine is key — healing yourself begins in your inner world, and healing the greater world begins within the walls of your own home.",
      prompt: "How can you invite more feminine energy — nurturing, nature, creativity — into your daily life?",
      imageUrl: "/cards/23-male.png",
      sortOrder: 23,
      accessType: "FREE",
      guestPreview: false,
    },
    {
      title: "Ceiling",
      message:
        "Ceiling teaches us that ascension and descension are two sides of the same spiritual coin. Living only in the light creates a spiritual addiction to bliss while ignoring the shadow aspects quietly waiting for illumination — like Icarus, flying too close to the sun will cause a fall. Yet living mostly in the dark pulls you into heaviness, convincing you that you are unloved and unworthy. The soul's true work is to find the center: recognize your extremes, seek what lies between them, and dissolve the patterns at their root so they quietly fall away from your energetic field.",
      prompt: "Where are you staying too high or too low? What would true center feel like?",
      imageUrl: "/cards/24-ceiling.png",
      sortOrder: 24,
      accessType: "FREE",
      guestPreview: false,
    },
    {
      title: "Hourglass",
      message:
        "Hourglass is the key of divine timing — the reminder that every moment has its proper place in the unfoldment of your life. Even when you already know the answer, there are times when waiting is the wisest action; at other moments, you are called to leap forward even before you feel fully ready. We are not meant to see the whole picture all at once — we are on a need-to-know basis, and demanding the final outcome can sabotage the very thing we're trying to create. Trust that everything is unfolding for your highest good, and that each perfectly timed step will benefit you in ways you cannot yet imagine.",
      prompt: "Where in your life do you need to trust the timing rather than forcing an outcome?",
      imageUrl: "/cards/25-hourglass.png",
      sortOrder: 25,
      accessType: "FREE",
      guestPreview: false,
    },
    {
      title: "Exit",
      message:
        "This key marks a threshold — a crossing point where one chapter closes and another begins. Something in your life is completing its cycle, inviting you to step through the doorway of change with grace and courage. The wisdom of knowing when to leave — to exit an old story, a harmful pattern, or a way of being that no longer serves you — is one of the most courageous acts on the spiritual path. Honor what was, release it with gratitude, and step forward into the new.",
      prompt: "What is completing its cycle in your life, and what are you stepping toward?",
      imageUrl: "/cards/26-exit.png",
      sortOrder: 26,
      accessType: "FREE",
      guestPreview: false,
    },
    {
      title: "Lady Beetle",
      message:
        "Lady Beetle is the key of releasing old wounds that hold you back from your greatness. Like a can opener piercing solid steel, Lady Beetle breaks through the hardened shell around your heart, allowing long-trapped beliefs to finally spill out and be freed. Just as the snake sheds its skin, the leaves release from the trees, and birds molt their worn feathers, you too are entering a season of release. Allow this shedding — your long-held beliefs are asking to be let go so that something more truth-filled can take their place.",
      prompt: "What old belief or pattern is ready to shed so something more true can take its place?",
      imageUrl: "/cards/27-lady-beetle.png",
      sortOrder: 27,
      accessType: "FREE",
      guestPreview: false,
    },
    {
      title: "Baseball Diamond",
      message:
        "The Baseball Diamond is a powerful metaphor for the journey to wholeness — it illustrates the choices we face, encouraging us to step up to the plate and confront our issues. The Merkabah is our personal diamond-shaped electrical field that protects us, and it is up to us to keep it healthy and clear of incompatible energies. The Universe responds to our intentions rather than our mental requests — when you intend, for your self-betterment, that you need something to happen, it will be put into play. Know that in the bleachers of life, the whole Universe is cheering you on.",
      prompt: "What decision or intention is ready to be put into play in your life?",
      imageUrl: "/cards/28-baseball-diamond.png",
      sortOrder: 28,
      accessType: "FREE",
      guestPreview: false,
    },
    {
      title: "Unity",
      message:
        "When the mind, body, and spirit come into alignment, our soul evolves and we become whole — our thoughts calm, our bodies feel grounded, our souls expand. This inner harmony makes us more patient, kind, and aware of how our actions affect the world around us. As more individuals integrate their incoherent parts, humanity shifts from fear and fragmentation toward cooperation, empathy, and clarity of purpose. Heal yourself, and you heal those close to you — and then they heal and influence others, until the whole community is healed.",
      prompt: "In what area of your life do you feel the most alignment between your thoughts, body, and spirit?",
      imageUrl: "/cards/29-unity.png",
      sortOrder: 29,
      accessType: "FREE",
      guestPreview: false,
    },
    {
      title: "Gods Eye II",
      message:
        "There are moments when the Divine falls completely silent, and this silence is the test: what do you do when the training wheels are removed? These moments aren't evidence of abandonment — they are evidence that you're ready for a deeper kind of relationship with your creator, built not on constant reassurance but on the quiet, steady courage of trust. The more you experience that you can move through fear and stay connected to your integrity even in silence, the more trust naturally grows. God may feel empty at times, but you are deservedly full — full of the strength, insight, and resilience you've cultivated through every stage of your life.",
      prompt: "What would it mean to trust your own inner anchor without waiting for an external sign?",
      imageUrl: "/cards/30-gods-eye-ii.png",
      sortOrder: 30,
      accessType: "FREE",
      guestPreview: false,
    },
    {
      title: "Openness",
      message:
        "Openness is the key that helps balance serving others with serving self. Empaths have a habit of putting others' needs in front of their own and neglecting their mental, emotional, and physical health — your job is to be an inspiration, not to heal everyone without permission. Source weighs our works, not counts them, and people who do not truly love themselves are unable to offer unconditional love to others. If you are comfortable in your own skin, others will feel comfortable around you and ask you for help rather than you going all in without permission.",
      prompt: "Where do you need to serve yourself first in order to truly serve others?",
      imageUrl: "/cards/31-openness.png",
      sortOrder: 31,
      accessType: "FREE",
      guestPreview: false,
    },
    {
      title: "Goddess Eye Full",
      message:
        "Goddess Eye Full is the key of the 2nd chakra — the feminine center of deep empathy, emotional intuition, and receptivity. When this chakra falls out of balance, it can create the illusion of victimhood, as if others are judging or diminishing your worth — but this feeling is an energetic distortion, not reality. You are an eternal, sovereign being, and nothing can take your power unless you put out the welcome mat for it to enter. Find time in nature, sink your hands and feet into the Earth, and remember: if you want to be respected, you must respect yourself first.",
      prompt: "What creative act could reconnect you to your sense of worth and feminine power?",
      imageUrl: "/cards/32-goddess-eye-full.png",
      sortOrder: 32,
      accessType: "FREE",
      guestPreview: false,
    },
    {
      title: "God Going Out",
      message:
        "God Going Out points to a shift away from old patterns of control, hierarchy, and externalized authority — what many would call the overactive masculine. When things in life stop working, it often reflects an inner system running on outdated beliefs: pushing over listening, striving over feeling, certainty over flow. This transition isn't about rejecting the masculine, but about integrating it with a more soul-based, receptive way of being. When the old 'god' steps out, it's because a deeper inner guidance is ready to step in.",
      prompt: "What outdated inner authority are you releasing to make room for a more soulful way of being?",
      imageUrl: "/cards/33-god-going-out.png",
      sortOrder: 33,
      accessType: "FREE",
      guestPreview: false,
    },
    {
      title: "Goddess Coming In",
      message:
        "Goddess Coming In is the key of receptivity — an invitation to trust the unknown, the invisible, and the subtle inner voice that speaks beneath the noise. The Goddess is Mother Nature herself; through her, you release all burdens and are returned to the Father for rebirth. This is the time for the reconnection of masculine and feminine, heaven and Earth, electricity and magnetism — spirit into the physical in equality. When you allow her wisdom, you allow life to open in ways you once thought impossible, because we were all made to believe we didn't deserve it — and that time is now over.",
      prompt: "What are you being invited to receive that you have been too guarded to accept?",
      imageUrl: "/cards/34-goddess-coming-in.png",
      sortOrder: 34,
      accessType: "FREE",
      guestPreview: false,
    },
    {
      title: "Female",
      message:
        "This is the key of deliberately blocking out the masculine energy, or the physical world. The act of pausing, disconnecting from the external, and truly listening is critical when the time comes to sit in the silent grace of the Great Void. The divine feminine is always with you, holding you, grounding you, and awaiting your recognition — when she signals that it is time to connect, it is often because she has an important message to deliver. If we do not take breaks and reconnect, gentle nudges may intensify into forceful shoves, so honor her invitation and make time to listen.",
      prompt: "What is the quiet inner voice of the feminine trying to tell you right now?",
      imageUrl: "/cards/35-female.png",
      sortOrder: 35,
      accessType: "FREE",
      guestPreview: false,
    },
    {
      title: "Scarab",
      message:
        "Once you've named the toxins within — old beliefs, worn-out behaviors, and the residue of past emotions — the next step is to let them go. This inner cleansing mirrors the sacred work of the scarab, who gathers what is decayed and repurposes it into something new and useful. Collect the remnants of who you once were, honor them for what they taught you, and roll them gently from your path — what was once heavy becomes rich compost to feed new life. Care for your inner garden with patience and devotion, and your harvest will bloom in perfect reflection of your efforts.",
      prompt: "What from your past can you honor, release, and compost into fuel for new growth?",
      imageUrl: "/cards/36-scarab.png",
      sortOrder: 36,
      accessType: "FREE",
      guestPreview: false,
    },
    {
      title: "Block",
      message:
        "Block is a key of pure energetic boundary holding — a firm declaration that negative influences can no longer enter your space. Imagine extending your hand outward, halting anything or anyone that seeks to drain, disrupt, or diminish you — this gesture does not need to be physical, your imagination is the conduit. You are the sovereign solid black diamond in the center, surrounded by the square of stability and the circle of wholeness, harmony, and completion. With this key, you reclaim authority over your energy, your peace, and your sovereignty.",
      prompt: "What boundary do you need to energetically declare to protect your peace and sovereignty?",
      imageUrl: "/cards/37-block.png",
      sortOrder: 37,
      accessType: "FREE",
      guestPreview: false,
    },
  ];

  for (const c of cards) {
    const existing = await prisma.card.findFirst({
      where: { deckId: deck.id, title: c.title },
    });
    const data = { ...c, deckId: deck.id, isActive: true };
    if (existing) {
      await prisma.card.update({ where: { id: existing.id }, data });
    } else {
      await prisma.card.create({ data });
    }
  }

  console.log(`seed: upserted ${cards.length} Sophionix Keys cards`);
}

async function main() {
  await seedDecks();
  await seedThemes();
  await seedCategories();
  await seedTags();
  await seedCards();
  await seedSophionixCards();
  await seedJourney();
  await seedSettings();
  await seedPlan();
  await seedTemplates();
  await seedSuperAdmin();
  await seedDailyPlatformStats();
  await seedCardUsageStats();
  await seedRetentionCohorts();
  await syncPlansToStripe();
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("seed: done");
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
