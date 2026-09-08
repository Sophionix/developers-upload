import { env } from "@/lib/env";

interface RecaptchaResponse {
  success: boolean;
  score: number;
  action?: string;
  "error-codes"?: string[];
}

/**
 * Verifies a reCAPTCHA v3 token against Google's siteverify endpoint.
 * Returns true if the score meets the configured minimum threshold.
 *
 * In non-production environments, the special token "dev-bypass" skips
 * the network call so local development and CI work without real tokens.
 */
export async function verifyCaptcha(token: string): Promise<boolean> {
  if (process.env.NODE_ENV !== "production" && token === "dev-bypass") {
    return true;
  }

  const params = new URLSearchParams({
    secret: env.RECAPTCHA_SECRET_KEY,
    response: token,
  });

  const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) return false;

  const data = (await res.json()) as RecaptchaResponse;
  return data.success && data.score >= env.RECAPTCHA_MIN_SCORE;
}
