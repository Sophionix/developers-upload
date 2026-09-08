import NextAuth, { CredentialsSignin, type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import Apple from "next-auth/providers/apple";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { redis } from "@/lib/redis";
import { verifyCaptcha } from "@/lib/captcha";
import { LOGIN_FAIL_KEY, LOGIN_FAIL_TTL_SEC, LOGIN_CAPTCHA_THRESHOLD } from "@/lib/auth/rate-limit";

const PLACEHOLDER_PREFIX = "CHANGE_ME";
const isConfigured = (v: string | undefined) =>
  Boolean(v) && !v!.startsWith(PLACEHOLDER_PREFIX);

export class AuthErrorCode extends CredentialsSignin {
  constructor(
    code:
      | "INVALID_CREDENTIALS"
      | "EMAIL_NOT_VERIFIED"
      | "ACCOUNT_DEACTIVATED"
      | "OAUTH_EMAIL_CONFLICT"
      | "CAPTCHA_REQUIRED"
      | "CAPTCHA_FAILED",
  ) {
    super(code);
    this.code = code;
  }
}

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  captchaToken: z.string().optional(),
});

const providers: NextAuthConfig["providers"] = [
  Credentials({
    credentials: { email: {}, password: {}, captchaToken: {} },
    async authorize(raw, req) {
      const parsed = credentialsSchema.safeParse(raw);
      if (!parsed.success) throw new AuthErrorCode("INVALID_CREDENTIALS");
      const { email, password, captchaToken } = parsed.data;
      const ip =
        (req?.headers?.get?.("x-forwarded-for") ?? "").split(",")[0]?.trim() ||
        "unknown";
      const userAgent = req?.headers?.get?.("user-agent") ?? null;

      // Check brute-force counter before hitting the DB
      const failKey = LOGIN_FAIL_KEY(email);
      const failCountRaw = await redis.get(failKey);
      const failCount = failCountRaw !== null ? Number.parseInt(failCountRaw, 10) : 0;

      if (failCount >= LOGIN_CAPTCHA_THRESHOLD) {
        if (!captchaToken) {
          throw new AuthErrorCode("CAPTCHA_REQUIRED");
        }
        const captchaOk = await verifyCaptcha(captchaToken);
        if (!captchaOk) {
          throw new AuthErrorCode("CAPTCHA_FAILED");
        }
      }

      const user = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          fullName: true,
          avatarUrl: true,
          role: true,
          status: true,
          hasCompletedOnboarding: true,
          passwordHash: true,
          emailVerifiedAt: true,
          subscription: { select: { tier: true } },
        },
      });

      const recordAttempt = async (success: boolean, reason?: string) => {
        await prisma.loginAttempt
          .create({
            data: {
              userId: user?.id ?? null,
              email,
              ip,
              userAgent,
              success,
              reason: reason ?? null,
            },
          })
          .catch((e) => logger.error({ err: e }, "login_attempt_write_failed"));
      };

      if (!user || !user.passwordHash) {
        await redis.incr(failKey);
        await redis.expire(failKey, LOGIN_FAIL_TTL_SEC);
        await recordAttempt(false, "INVALID_CREDENTIALS");
        throw new AuthErrorCode("INVALID_CREDENTIALS");
      }
      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) {
        await redis.incr(failKey);
        await redis.expire(failKey, LOGIN_FAIL_TTL_SEC);
        await recordAttempt(false, "INVALID_CREDENTIALS");
        throw new AuthErrorCode("INVALID_CREDENTIALS");
      }
      if (!user.emailVerifiedAt) {
        await redis.incr(failKey);
        await redis.expire(failKey, LOGIN_FAIL_TTL_SEC);
        await recordAttempt(false, "EMAIL_NOT_VERIFIED");
        throw new AuthErrorCode("EMAIL_NOT_VERIFIED");
      }
      if (user.status !== "ACTIVE") {
        await redis.incr(failKey);
        await redis.expire(failKey, LOGIN_FAIL_TTL_SEC);
        await recordAttempt(false, "ACCOUNT_DEACTIVATED");
        throw new AuthErrorCode("ACCOUNT_DEACTIVATED");
      }

      // Successful login — clear the fail counter
      await redis.del(failKey);
      await recordAttempt(true);
      return {
        id: user.id,
        email: user.email,
        name: user.fullName,
        image: user.avatarUrl ?? null,
        role: user.role,
        status: user.status,
        hasCompletedOnboarding: user.hasCompletedOnboarding,
        subscriptionTier: user.subscription?.tier ?? "FREE",
      };
    },
  }),
];

if (
  isConfigured(process.env.AUTH_GOOGLE_ID) &&
  isConfigured(process.env.AUTH_GOOGLE_SECRET)
) {
  providers.push(Google);
} else {
  logger.warn(
    "auth: Google provider skipped (AUTH_GOOGLE_ID/SECRET not configured)",
  );
}

if (
  isConfigured(process.env.AUTH_APPLE_ID) &&
  isConfigured(process.env.AUTH_APPLE_TEAM_ID) &&
  isConfigured(process.env.AUTH_APPLE_KEY_ID) &&
  isConfigured(process.env.AUTH_APPLE_PRIVATE_KEY)
) {
  providers.push(Apple);
} else {
  logger.warn("auth: Apple provider skipped (Apple env not configured)");
}

const basePrismaAdapter = PrismaAdapter(prisma);
const adapter: typeof basePrismaAdapter = {
  ...basePrismaAdapter,
  async createUser(data) {
    const { name, image, email, emailVerified } = data as {
      name?: string | null;
      image?: string | null;
      email: string;
      emailVerified?: Date | null;
    };
    const created = await prisma.user.create({
      data: {
        email,
        emailVerifiedAt: emailVerified ?? null,
        fullName: name?.trim() || email.split("@")[0] || "User",
        avatarUrl: image ?? null,
      },
    });
    return {
      id: created.id,
      email: created.email,
      emailVerified: created.emailVerifiedAt,
      name: created.fullName,
      image: created.avatarUrl,
    } as Awaited<ReturnType<NonNullable<typeof basePrismaAdapter.createUser>>>;
  },
};

const config: NextAuthConfig = {
  adapter,
  secret: env.AUTH_SECRET,
  trustHost: env.AUTH_TRUST_HOST,
  session: { strategy: "jwt" },
  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-authjs.session-token"
          : "authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  providers,
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!account || account.provider === "credentials") return true;

      const email = user.email ?? (profile?.email as string | undefined);
      if (!email) return true;

      const existing = await prisma.user.findUnique({
        where: { email },
        include: { accounts: true },
      });
      if (!existing) return true;

      const alreadyLinked = existing.accounts.some(
        (a) =>
          a.provider === account.provider &&
          a.providerAccountId === account.providerAccountId,
      );
      if (alreadyLinked) return true;

      // Auto-link this OAuth identity to the existing account when the provider
      // has VERIFIED the email address. Google always verifies (email_verified),
      // so a Google-verified email is a safe signal the sign-in owns the account.
      // Without a verified email we refuse, to prevent account takeover by
      // signing up an OAuth identity under someone else's email.
      const emailVerifiedByProvider =
        account.provider === "google" &&
        (profile as { email_verified?: boolean } | undefined)?.email_verified ===
          true;

      if (emailVerifiedByProvider) {
        await prisma.account.create({
          data: {
            userId: existing.id,
            type: account.type,
            provider: account.provider,
            providerAccountId: account.providerAccountId,
            refresh_token: account.refresh_token ?? null,
            access_token: account.access_token ?? null,
            expires_at: account.expires_at ?? null,
            token_type: account.token_type ?? null,
            scope: account.scope ?? null,
            id_token: account.id_token ?? null,
            session_state:
              account.session_state != null
                ? String(account.session_state)
                : null,
          },
        });
        // Ensure the existing user is marked email-verified now that a verified
        // provider vouches for it (e.g. an unverified password signup).
        if (!existing.emailVerifiedAt) {
          await prisma.user.update({
            where: { id: existing.id },
            data: { emailVerifiedAt: new Date() },
          });
        }
        logger.info(
          { userId: existing.id, provider: account.provider },
          "oauth_account_auto_linked",
        );
        return true;
      }

      logger.warn(
        { email, provider: account.provider },
        "oauth_email_conflict",
      );
      throw new AuthErrorCode("OAUTH_EMAIL_CONFLICT");
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        const u = user as unknown as {
          role?: string;
          status?: string;
          hasCompletedOnboarding?: boolean;
          subscriptionTier?: string;
        };
        token.role = u.role;
        token.status = u.status;
        token.hasCompletedOnboarding = u.hasCompletedOnboarding;
        token.subscriptionTier = u.subscriptionTier;
      }
      return token;
    },
    async session({ session, token }) {
      const userId = token.id as string;
      const db = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          role: true,
          status: true,
          hasCompletedOnboarding: true,
          fullName: true,
          avatarUrl: true,
          subscription: { select: { tier: true } },
        },
      });
      if (db) {
        session.user.id = userId;
        session.user.role = db.role;
        session.user.status = db.status;
        session.user.hasCompletedOnboarding = db.hasCompletedOnboarding;
        session.user.subscriptionTier = db.subscription?.tier ?? "FREE";
        session.user.name = db.fullName;
        session.user.image = db.avatarUrl ?? null;
        session.user.mfaRequired =
          db.role === "SUPER_ADMIN" || db.role === "CONTENT_MANAGER";

        if (session.user.mfaRequired) {
          const verified = await redis.get(`mfa:verified:${userId}`);
          session.user.mfaVerified = verified !== null;
        } else {
          session.user.mfaVerified = false;
        }
      }
      return session;
    },
  },
  events: {
    async signIn({ user, account }) {
      logger.info(
        { userId: user.id, provider: account?.provider },
        "auth.signIn",
      );
    },
    async signOut(message) {
      const userId =
        "session" in message ? message.session?.userId : message.token?.sub;
      logger.info({ userId }, "auth.signOut");
    },
    async createUser({ user }) {
      if (!user.email) return;
      // Apple/Google first-login may provide email; persist it explicitly when an Apple
      // account is later linked without email, we already have it from first sign-in.
      logger.info({ userId: user.id }, "auth.createUser");
    },
    async linkAccount({ user, account, profile }) {
      if (account.provider === "apple" && profile?.email && user.id) {
        const existing = await prisma.user.findUnique({
          where: { id: user.id },
          select: { email: true },
        });
        if (existing && !existing.email) {
          await prisma.user.update({
            where: { id: user.id },
            data: { email: profile.email },
          });
        }
      }
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(config);
