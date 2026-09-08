import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { isRevoked } from "@/lib/session-blocklist";
import { UserRole } from "@/generated/prisma/enums";

const SESSION_COOKIE_NAME =
  process.env.NODE_ENV === "production"
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";

const ADMIN_ROLES: readonly UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.CONTENT_MANAGER,
];

// Pages that authenticated users should be redirected away from
const AUTH_PAGES = ["/login", "/signup", "/forgot-password"] as const;

// Pages accessible without any authentication
const PUBLIC_PAGES = [
  "/welcome",
  "/guest",
  "/privacy",
  "/terms",
  "/subscription",
] as const;

// User-only routes that require a valid session
const USER_ROUTES = [
  "/dashboard",
  "/journal",
  "/billing",
  "/settings",
  "/my-profile",
  "/edit-profile",
  "/saved",
  "/recordings",
  "/notifications",
  "/cards",
] as const;

function isAdminPath(pathname: string): boolean {
  return pathname.startsWith("/admin") || pathname.startsWith("/api/admin");
}

function isUserRoute(pathname: string): boolean {
  return USER_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

function isPublicPage(pathname: string): boolean {
  return PUBLIC_PAGES.some(
    (page) => pathname === page || pathname.startsWith(`${page}/`),
  );
}

function isAuthPage(pathname: string): boolean {
  return AUTH_PAGES.some(
    (page) => pathname === page || pathname.startsWith(`${page}/`),
  );
}

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  return fwd.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

export async function proxy(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  const requestHeaders = new Headers(req.headers);
  if (!requestHeaders.get("x-request-id"))
    requestHeaders.set("x-request-id", randomUUID());

  const proceed = () =>
    NextResponse.next({ request: { headers: requestHeaders } });

  const redirect = (path: string) =>
    NextResponse.redirect(new URL(path, req.url));

  // --- Rate-limit auth API endpoints ---
  if (pathname.startsWith("/api/auth/")) {
    const ip = clientIp(req);
    const rl = await rateLimit({
      key: `mw:auth:${ip}`,
      limit: 30,
      windowSec: 60,
    });
    if (!rl.ok) {
      const retryAfter = Math.max(
        1,
        Math.ceil((rl.resetAt - Date.now()) / 1000),
      );
      return NextResponse.json(
        { ok: false, code: "RATE_LIMITED" },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      );
    }
  }

  // --- Step 0: Public pages — always accessible ---
  if (isPublicPage(pathname)) {
    return proceed();
  }

  const sessionToken = req.cookies.get(SESSION_COOKIE_NAME)?.value ?? null;

  // --- Revoked session check ---
  if (sessionToken && (await isRevoked(sessionToken))) {
    const res = redirect("/login");
    res.cookies.delete(SESSION_COOKIE_NAME);
    return res;
  }

  // --- Resolve session via Auth.js (decodes JWT + runs session callback) ---
  const session = await auth();

  // --- Step 1: No session + protected route → redirect to /login ---
  if (!session?.user && isUserRoute(pathname)) {
    return redirect("/login");
  }

  // Unauthenticated users can access auth pages and other non-protected routes
  if (!session?.user) {
    return proceed();
  }

  // Deactivated user — clear cookie and redirect
  if (session.user.status !== "ACTIVE") {
    const res = redirect("/login");
    res.cookies.delete(SESSION_COOKIE_NAME);
    return res;
  }

  const role = session.user.role as UserRole;
  const hasCompletedOnboarding = session.user.hasCompletedOnboarding;
  const needsPlanSelection = session.user.subscriptionTier === "FREE";

  // --- Admin path guardrails (existing) ---
  if (isAdminPath(pathname)) {
    if (!ADMIN_ROLES.includes(role)) {
      return NextResponse.json(
        { ok: false, code: "FORBIDDEN_ROLE" },
        { status: 403 },
      );
    }

    return proceed();
  }

  // --- User auth guardrail chain ---

  // TODO: Step 2 — emailVerifiedAt check. The session callback doesn't expose
  // emailVerifiedAt. The backend already blocks login for unverified emails via
  // AuthErrorCode("EMAIL_NOT_VERIFIED"), so this is enforced at login time.
  // If we need proxy-level enforcement later, add emailVerifiedAt to the
  // session select and redirect to /forgot-password/verify here.

  // Step 4: Onboarding not completed → redirect to /profile
  if (
    !hasCompletedOnboarding &&
    pathname !== "/profile" &&
    pathname !== "/edit-profile" &&
    pathname !== "/2fa"
  ) {
    return redirect("/profile");
  }

  // Step 5: Already-paid users visiting /subscription don't need the paywall again.
  if (pathname === "/subscription" && !needsPlanSelection) {
    return redirect("/dashboard");
  }

  // Step 6: Authenticated user on auth pages → dashboard. FREE tier is a
  // usable plan, not a gate — users choose to upgrade from /billing.
  if (isAuthPage(pathname)) {
    return redirect("/dashboard");
  }

  // Step 7: Allow
  logger.debug(
    { pathname, requestId: requestHeaders.get("x-request-id") },
    "mw.pass",
  );
  return proceed();
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico|api/webhooks/|.*\\.[^/]+$).*)"],
};
