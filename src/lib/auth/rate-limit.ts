// Redis key for tracking consecutive failed logins per email address.
// TTL is 900s (15 min) — resets on successful login or natural expiry.
export const LOGIN_FAIL_KEY = (email: string) => `rl:login_fail:${email}`;
export const LOGIN_FAIL_TTL_SEC = 900;
export const LOGIN_CAPTCHA_THRESHOLD = 3;
