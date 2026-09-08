/**
 * Copy every object from the Firebase Storage bucket into S3 with the SAME key.
 * Idempotent: skips objects already present in S3. Keys are preserved, so DB
 * rows that store bare storage paths (voiceNote.storagePath) need no rewrite.
 *
 * Run: node --env-file=.env node_modules/tsx/dist/cli.mjs scripts/migrate-firebase-to-s3.ts
 */
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import { putObject, objectExists } from "@/lib/s3";

const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
if (!raw || !bucketName) {
  console.error("Firebase env missing");
  process.exit(1);
}
const sa = JSON.parse(raw) as {
  project_id: string;
  client_email: string;
  private_key: string;
};
const app =
  getApps()[0] ??
  initializeApp({
    credential: cert({
      projectId: sa.project_id,
      clientEmail: sa.client_email,
      privateKey: sa.private_key,
    }),
    storageBucket: bucketName,
  });

async function main() {
  const bucket = getStorage(app).bucket();
  const [files] = await bucket.getFiles();
  console.log(`Found ${files.length} objects in Firebase bucket ${bucketName}`);

  let copied = 0;
  let skipped = 0;
  for (const f of files) {
    const key = f.name;
    if (await objectExists(key)) {
      console.log("  skip (exists):", key);
      skipped++;
      continue;
    }
    const [buf] = await f.download();
    const contentType =
      (typeof f.metadata?.contentType === "string"
        ? f.metadata.contentType
        : undefined) ?? "application/octet-stream";
    await putObject(key, buf, contentType);
    console.log(`  copied: ${key} (${buf.length} bytes, ${contentType})`);
    copied++;
  }
  console.log(`\nDone. copied=${copied} skipped=${skipped}`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error("MIGRATE FAILED:", err?.message ?? err);
    process.exit(1);
  },
);
