import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Readable } from "node:stream";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

// AWS S3 storage backend.
//
// SECURITY / ARCHITECTURE (see docs/S3_SETUP_MASTER_PROMPT.md):
// - Credentials resolve via the AWS SDK DEFAULT CREDENTIAL CHAIN — locally from
//   ~/.aws/credentials, in production from the server's IAM role. NO access keys
//   or secrets in code or in .env, ever.
// - The bucket is PRIVATE (all public access blocked). Uploads use short-lived
//   presigned PUT URLs; the client uploads bytes straight to S3.
// - PUBLIC reads (card art, avatars) are served through CloudFront (env
//   S3_ACCESS_URL). Direct S3 object URLs return 403; only the CDN can read.
// - PRIVATE reads (voice notes) are NOT exposed via CloudFront — they are
//   proxied through ownership-checked routes or short-lived presigned GET URLs.

export class StorageNotConfiguredError extends Error {
  readonly code = "STORAGE_NOT_CONFIGURED" as const;
  constructor(
    message = "S3 storage is not configured. Set S3_BUCKET and S3_ACCESS_URL in .env.",
  ) {
    super(message);
    this.name = "StorageNotConfiguredError";
  }
}

function looksLikePlaceholder(v: string | undefined): boolean {
  if (!v) return true;
  return /CHANGE_ME|placeholder/i.test(v);
}

export function isStorageConfigured(): boolean {
  return (
    !looksLikePlaceholder(env.S3_BUCKET) &&
    !looksLikePlaceholder(env.S3_ACCESS_URL)
  );
}

let cachedClient: S3Client | undefined;

function getClient(): S3Client {
  if (!isStorageConfigured()) throw new StorageNotConfiguredError();
  if (cachedClient) return cachedClient;
  // No inline credentials — resolved from the default chain (IAM role / ~/.aws).
  cachedClient = new S3Client(
    env.S3_REGION ? { region: env.S3_REGION } : {},
  );
  return cachedClient;
}

function requireBucket(): string {
  if (!isStorageConfigured()) throw new StorageNotConfiguredError();
  return env.S3_BUCKET as string;
}

/** Build a public CloudFront read URL for an object key. */
export function publicUrl(key: string): string {
  if (!isStorageConfigured()) throw new StorageNotConfiguredError();
  const base = (env.S3_ACCESS_URL as string).replace(/\/+$/, "");
  const cleanKey = key.replace(/^\/+/, "");
  return `${base}/${cleanKey}`;
}

export interface UploadUrlArgs {
  path: string;
  contentType: string;
  maxBytes: number;
  ttlSec: number;
}

export interface UploadUrlResult {
  url: string;
  path: string;
  headers: Record<string, string>;
}

/**
 * Issue a short-lived presigned PUT URL. The client uploads bytes directly to
 * S3 with exactly the returned headers (Content-Type only — the signature is
 * bound to it, so extra headers would break verification).
 */
export async function issueUploadUrl(
  args: UploadUrlArgs,
): Promise<UploadUrlResult> {
  const cmd = new PutObjectCommand({
    Bucket: requireBucket(),
    Key: args.path,
    ContentType: args.contentType,
  });
  const url = await getSignedUrl(getClient(), cmd, {
    expiresIn: args.ttlSec,
  });
  return {
    url,
    path: args.path,
    headers: { "Content-Type": args.contentType },
  };
}

/**
 * Issue a short-lived presigned GET URL for a private object (e.g. voice-note
 * download). Public assets should use publicUrl() (CloudFront) instead.
 */
export async function issueDownloadUrl(
  path: string,
  ttlSec: number,
): Promise<{ url: string }> {
  const cmd = new GetObjectCommand({ Bucket: requireBucket(), Key: path });
  const url = await getSignedUrl(getClient(), cmd, { expiresIn: ttlSec });
  return { url };
}

export interface ObjectMetadata {
  contentType: string | undefined;
  size: number;
  updated: string | undefined;
}

export async function readObjectMetadata(
  path: string,
): Promise<ObjectMetadata> {
  const out = await getClient().send(
    new HeadObjectCommand({ Bucket: requireBucket(), Key: path }),
  );
  return {
    contentType: out.ContentType,
    size: typeof out.ContentLength === "number" ? out.ContentLength : 0,
    updated: out.LastModified ? out.LastModified.toISOString() : undefined,
  };
}

export async function putObject(
  path: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  await getClient().send(
    new PutObjectCommand({
      Bucket: requireBucket(),
      Key: path,
      Body: body,
      ContentType: contentType,
      ContentLength: body.byteLength,
    }),
  );
}

export interface ObjectBodyResult {
  body: Readable;
  contentType: string;
  contentLength: number | undefined;
  contentRange: string | undefined;
}

/**
 * Fetch an object body (optionally a byte range) for server-side streaming.
 * Used by the ownership-checked voice-note stream route so private audio is
 * never exposed via the public CDN.
 */
export async function getObjectBody(
  path: string,
  range?: string,
): Promise<ObjectBodyResult> {
  const out = await getClient().send(
    new GetObjectCommand({
      Bucket: requireBucket(),
      Key: path,
      ...(range ? { Range: range } : {}),
    }),
  );
  return {
    body: out.Body as Readable,
    contentType: out.ContentType ?? "application/octet-stream",
    contentLength:
      typeof out.ContentLength === "number" ? out.ContentLength : undefined,
    contentRange: out.ContentRange,
  };
}

export async function objectExists(path: string): Promise<boolean> {
  try {
    await getClient().send(
      new HeadObjectCommand({ Bucket: requireBucket(), Key: path }),
    );
    return true;
  } catch (err) {
    const name = (err as { name?: string })?.name;
    if (name === "NotFound" || name === "NoSuchKey") return false;
    throw err;
  }
}

export async function deleteObject(path: string): Promise<void> {
  try {
    await getClient().send(
      new DeleteObjectCommand({ Bucket: requireBucket(), Key: path }),
    );
  } catch (err) {
    logger.error({ err, path }, "storage_delete_failed");
  }
}
