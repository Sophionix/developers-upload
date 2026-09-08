export const ERROR_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: "Session expired, please sign in again",
  RATE_LIMITED: "Too many attempts, please try again later",
  ENTITLEMENT_REQUIRED: "This feature requires a premium subscription",
  NOT_FOUND: "The requested resource was not found",
  CONFLICT: "This action conflicts with existing data",
  VALIDATION_ERROR: "Please check your input and try again",
  INVALID_INPUT: "Please check your input and try again",
  STORAGE_NOT_CONFIGURED: "File storage is not available",
  INVALID_CREDENTIALS: "Wrong email or password",
  EMAIL_NOT_VERIFIED: "Please verify your email first",
  ACCOUNT_DEACTIVATED: "Your account has been deactivated",
  OAUTH_EMAIL_CONFLICT:
    "This email is already linked to another sign-in method",
  CAPTCHA_REQUIRED: "Please complete the CAPTCHA verification",
  CAPTCHA_FAILED: "CAPTCHA verification failed, please try again",
  INVALID_TOKEN: "This link is invalid or has already been used",
  TOKEN_EXPIRED: "This link has expired, please request a new one",
  INVALID_CODE: "Invalid verification code, please try again",
  TOTP_NOT_SETUP: "Two-factor authentication is not set up",
  MFA_REQUIRED: "Two-factor authentication is required",
  FORBIDDEN: "You don't have permission to access this resource",
  MISSING_PATH: "Required file path is missing",
  SIZE_TOO_LARGE: "File is too large to upload",
  INTERNAL_ERROR: "An unexpected error occurred, please try again",
  UNAUTHENTICATED: "Please sign in to continue",
};

export function getErrorMessage(
  code: string,
  serverMessage?: string,
): string {
  return serverMessage ?? ERROR_MESSAGES[code] ?? "Something went wrong, please try again";
}
