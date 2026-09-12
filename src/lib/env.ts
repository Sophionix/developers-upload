import { z } from "zod";
import {
  buildDatabaseConnectionUrl,
  resolveDatabaseConnectionConfig,
} from "../../scripts/database-config.mjs";

const boolish = (fallback?: boolean) => {
  const base = z.enum(["true", "false", "1", "0"]);
  const withDefault =
    fallback === undefined ? base : base.default(fallback ? "true" : "false");
  return withDefault.transform((v) => v === "true" || v === "1");
};

const intString = (fallback?: number) => {
  const base = z.string().regex(/^-?\d+$/, "must be an integer");
  const withDefault =
    fallback === undefined ? base : base.default(String(fallback));
  return withDefault.transform((v) => Number.parseInt(v, 10));
};

const floatString = (fallback?: number) => {
  const base = z.string().regex(/^-?\d+(\.\d+)?$/, "must be a number");
  const withDefault =
    fallback === undefined ? base : base.default(String(fallback));
  return withDefault.transform((v) => Number.parseFloat(v));
};

const envSchema = z.object({
  // -- Runtime ----------------------------------------------------------------
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url(),

  // -- Database ---------------------------------------------------------------
  DATABASE_URL: z.string().min(1).optional(),
  MYSQL_URL: z.string().min(1).optional(),
  DB_HOST: z.string().min(1).optional(),
  DB_PORT: z.string().min(1).optional(),
  DB_USER: z.string().min(1).optional(),
  DB_PASSWORD: z.string().min(1).optional(),
  DB_NAME: z.string().min(1).optional(),
  MYSQLHOST: z.string().min(1).optional(),
  MYSQLPORT: z.string().min(1).optional(),
  MYSQLUSER: z.string().min(1).optional(),
  MYSQLPASSWORD: z.string().min(1).optional(),
  MYSQLDATABASE: z.string().min(1).optional(),

  // -- Redis (optional — falls back to in-memory store when absent) ----------
  REDIS_URL: z.string().url().optional(),

  // -- Auth.js v5 -------------------------------------------------------------
  AUTH_SECRET: z.string().min(16),
  AUTH_TRUST_HOST: boolish(true),

  // -- Admin 2FA / crypto -----------------------------------------------------
  TOTP_SECRET_KEY: z.string().min(16),
  TOTP_ISSUER: z.string().min(1),

  // -- WebAuthn ---------------------------------------------------------------
  WEBAUTHN_RP_ID: z.string().min(1),
  WEBAUTHN_RP_NAME: z.string().min(1),
  WEBAUTHN_ORIGIN: z.string().url(),
  FEATURE_WEBAUTHN: boolish(true),

  // -- reCAPTCHA v3 -----------------------------------------------------------
  RECAPTCHA_SECRET_KEY: z.string().min(1),
  RECAPTCHA_MIN_SCORE: floatString(0.5),

  // -- Stripe -----------------------------------------------------------------
   // Stripe is optional for deployments that do not use payments.
  // Missing Stripe envs should not break builds; runtime code still guards access.
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  STRIPE_API_VERSION: z.string().min(1).default("2023-08-16"),
  CARD_UNLOCK_PRICE_CENTS: intString(199),
  CARD_UNLOCK_CURRENCY: z.string().length(3).default("USD"),
  STRIPE_CHECKOUT_SUCCESS_URL: z.string().url().optional(),
  STRIPE_CHECKOUT_CANCEL_URL: z.string().url().optional(),

  // -- Firebase (server — retained for FCM push messaging only) ---------------
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().min(1).optional(),
  FIREBASE_STORAGE_BUCKET: z.string().min(1).optional(),

  // -- Upload limits ----------------------------------------------------------
  UPLOAD_MAX_AVATAR_BYTES: intString(5242880),
  UPLOAD_MAX_CARD_ART_BYTES: intString(8388608),
  UPLOAD_MAX_VOICE_BYTES: intString(8388608),
  UPLOAD_MAX_VOICE_DURATION_MS: intString(1200000),

  // -- Email (optional until SMTP credentials are configured) -----------------
  EMAIL_FROM: z.string().min(1).optional(),
  EMAIL_REPLY_TO: z.string().min(1).optional(),
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: intString(587),
  SMTP_SECURE: boolish(false),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASSWORD: z.string().min(1).optional(),
  MAILER_TRANSPORT: z.enum(["smtp", "ses", "stream"]).default("smtp"),

  // -- Cron -------------------------------------------------------------------
  CRON_SECRET: z.string().min(1),

  // -- GDPR -------------------------------------------------------------------
  GDPR_DELETION_GRACE_DAYS: intString(30),

  // -- Guest sessions ---------------------------------------------------------
  GUEST_SESSION_SECRET: z.string().min(16),
  GUEST_SESSION_TTL_DAYS: intString(30),
});

type ParsedEnv = z.infer<typeof envSchema>;
export type Env = ParsedEnv & { DATABASE_URL: string };

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("\n  ");
    throw new Error(`Invalid environment:\n  ${issues}`);
  }

  const databaseConfig = resolveDatabaseConnectionConfig(result.data);

  return {
    ...result.data,
    DATABASE_URL: buildDatabaseConnectionUrl(databaseConfig),
  };
}

let cached: Env | undefined;

export const env: Env = new Proxy({} as Env, {
  get(_target, prop: string) {
    cached ??= parseEnv(process.env);
    return cached[prop as keyof Env];
  },
});
