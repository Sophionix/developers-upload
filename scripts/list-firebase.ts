/**
 * List objects currently in the Firebase Storage bucket, to size the migration.
 * Run: node --env-file=.env node_modules/tsx/dist/cli.mjs scripts/list-firebase.ts
 */
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";

const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
if (!raw || !bucketName) {
  console.error("FIREBASE_SERVICE_ACCOUNT_JSON / FIREBASE_STORAGE_BUCKET missing");
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
  console.log(`Bucket: ${bucketName}`);
  console.log(`Total objects: ${files.length}`);
  const byPrefix: Record<string, number> = {};
  let bytes = 0;
  for (const f of files) {
    const top = f.name.split("/")[0] || "(root)";
    byPrefix[top] = (byPrefix[top] ?? 0) + 1;
    bytes += Number(f.metadata?.size ?? 0);
  }
  console.log("By top-level prefix:", byPrefix);
  console.log(`Total size: ${(bytes / 1024 / 1024).toFixed(2)} MB`);
  console.log("\nSample keys:");
  files.slice(0, 15).forEach((f) => console.log("  ", f.name));
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error("LIST FAILED:", err?.message ?? err);
    process.exit(1);
  },
);
