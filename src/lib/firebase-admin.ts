import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getMessaging as getFcmMessaging, type Messaging } from "firebase-admin/messaging";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

// Firebase Admin — retained ONLY for FCM push messaging. File storage moved to
// AWS S3 + CloudFront (see src/lib/s3.ts / src/lib/storage.ts).

export class FirebaseNotConfiguredError extends Error {
  readonly code = "FIREBASE_NOT_CONFIGURED" as const;
  constructor(
    message = "Firebase is not configured. Fill FIREBASE_SERVICE_ACCOUNT_JSON in .env.",
  ) {
    super(message);
    this.name = "FirebaseNotConfiguredError";
  }
}

interface ServiceAccount {
  project_id?: string;
  private_key?: string;
  client_email?: string;
}

interface FirebaseState {
  configured: boolean;
  app?: App;
}

// WHY: init must be lazy — eager init at module load breaks Next build's
// page-data collection when FIREBASE_SERVICE_ACCOUNT_JSON is a placeholder.
let memoizedState: FirebaseState | undefined;

function parseServiceAccount(raw: string): ServiceAccount | null {
  try {
    return JSON.parse(raw) as ServiceAccount;
  } catch {
    return null;
  }
}

function looksLikePlaceholder(sa: ServiceAccount): boolean {
  const { project_id, client_email, private_key } = sa;
  if (!project_id || !client_email || !private_key) return true;
  const combined = `${project_id}\n${client_email}\n${private_key}`;
  return /CHANGE_ME/i.test(combined);
}

function resolveState(): FirebaseState {
  if (memoizedState) return memoizedState;
  if (!env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    logger.warn("firebase_admin_not_configured");
    memoizedState = { configured: false };
    return memoizedState;
  }
  const parsed = parseServiceAccount(env.FIREBASE_SERVICE_ACCOUNT_JSON);
  if (!parsed || looksLikePlaceholder(parsed)) {
    logger.warn("firebase_admin_not_configured");
    memoizedState = { configured: false };
    return memoizedState;
  }
  try {
    const existing = getApps()[0];
    const app =
      existing ??
      initializeApp({
        credential: cert({
          projectId: parsed.project_id!,
          clientEmail: parsed.client_email!,
          privateKey: parsed.private_key!,
        }),
      });
    memoizedState = { configured: true, app };
  } catch (err) {
    logger.error({ err }, "firebase_admin_init_failed");
    throw err;
  }
  return memoizedState;
}

export function getAdmin(): App {
  const state = resolveState();
  if (!state.configured || !state.app) throw new FirebaseNotConfiguredError();
  return state.app;
}

export function isMessagingConfigured(): boolean {
  return resolveState().configured;
}

export function getMessaging(): Messaging {
  return getFcmMessaging(getAdmin());
}
