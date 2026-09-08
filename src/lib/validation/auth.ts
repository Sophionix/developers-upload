import { z } from "zod";

// zxcvbn is loaded lazily so it doesn't bloat the module graph at build time
let _zxcvbn: typeof import("zxcvbn") | null = null;
function getZxcvbn() {
  if (!_zxcvbn) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _zxcvbn = require("zxcvbn");
  }
  return _zxcvbn!;
}

const strongPassword = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be at most 128 characters")
  .refine(
    (p) => getZxcvbn()(p).score >= 3,
    "Password is too weak — try adding numbers, symbols, or more words",
  );

export const signupSchema = z.object({
  fullName: z.string({ error: "Full name is required" }).trim().min(1, "Full name is required").max(120, "Full name is too long"),
  email: z.string({ error: "Email is required" }).trim().toLowerCase().email("Please enter a valid email address").max(255),
  password: strongPassword,
  consentTerms: z.literal(true, { error: "You must agree to the Terms & Privacy Policy" }),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const verifyEmailSchema = z.object({
  email: z.string({ error: "Email is required" }).trim().toLowerCase().email("Please enter a valid email address").max(255),
  code: z.string({ error: "Verification code is required" }).regex(/^\d{6}$/, "Code must be exactly 6 digits"),
  intent: z.enum(["signup", "reset"]).default("signup"),
});

export const forgotPasswordSchema = z.object({
  email: z.string({ error: "Email is required" }).trim().toLowerCase().email("Please enter a valid email address").max(255),
});

export const resetPasswordSchema = z.object({
  email: z.string({ error: "Email is required" }).trim().toLowerCase().email("Please enter a valid email address").max(255),
  token: z.string({ error: "Reset token is required" }).min(6, "Invalid reset token").max(200),
  password: strongPassword,
}).transform((d) => ({ ...d, newPassword: d.password }));

export const totpSetupSchema = z.object({}).strict();

export const totpVerifySchema = z.object({
  code: z.string({ error: "Verification code is required" }).regex(/^\d{6}$/, "Code must be exactly 6 digits"),
  intent: z.enum(["enable", "step-up", "email-otp"], { error: "Invalid verification intent" }),
});

export const totpEmailOtpSchema = z.object({}).strict();
