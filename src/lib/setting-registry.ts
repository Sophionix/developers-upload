import { z, type ZodType } from "zod";
import { ValidationError } from "@/lib/errors";

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const cuid = z.string().min(1).max(40);
const email = z.string().email();

export const SETTING_REGISTRY: Record<string, ZodType> = {
  card_unlock_price_cents: z.number().int().min(0),
  guest_login_enabled: z.boolean(),
  daily_card_default_hour: z.number().int().min(0).max(23),
  "branding.logoUrl": z.string().url(),
  "branding.primaryColor": hexColor,
  featured_decks: z.array(cuid).max(50),
  analytics_export_email_recipients: z.array(email).max(20),
  gdpr_deletion_grace_days: z.number().int().min(1).max(365),
};

export function isKnownSettingKey(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(SETTING_REGISTRY, key);
}

export function validateSettingValue(key: string, value: unknown): unknown {
  const schema = SETTING_REGISTRY[key];
  if (!schema) throw new ValidationError(`unknown_setting_key:${key}`);
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ValidationError(
      `invalid_setting_value:${key}:${result.error.issues.map((i) => i.message).join(",")}`,
    );
  }
  return result.data;
}
