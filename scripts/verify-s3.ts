/**
 * End-to-end verification of the S3 storage code path (not just infra):
 *  1. issueUploadUrl() -> presigned PUT, upload bytes via fetch (client flow)
 *  2. publicUrl() over CloudFront -> 200 with correct content-type
 *  3. direct S3 URL -> 403 (private bucket)
 *  4. readObjectMetadata() / objectExists() / getObjectBody(range) / deleteObject()
 *
 * Run: node --env-file=.env node_modules/.bin/tsx scripts/verify-s3.ts
 */
import {
  issueUploadUrl,
  publicUrl,
  readObjectMetadata,
  objectExists,
  getObjectBody,
  deleteObject,
} from "@/lib/s3";
import { env } from "@/lib/env";

async function main() {
  const key = `_healthcheck/app-path-${Date.now()}.txt`;
  const bodyText = "sophionix-app-path-ok";
  const contentType = "text/plain";

  // 1. presigned PUT (server) + client upload
  const { url, headers } = await issueUploadUrl({
    path: key,
    contentType,
    maxBytes: 1024,
    ttlSec: 300,
  });
  const put = await fetch(url, { method: "PUT", headers, body: bodyText });
  console.log("1. presigned PUT      ->", put.status, put.ok ? "OK" : "FAIL");
  if (!put.ok) throw new Error(`PUT failed: ${put.status} ${await put.text()}`);

  // 2. CloudFront read
  const cdn = publicUrl(key);
  const cf = await fetch(cdn);
  const cfText = await cf.text();
  console.log(
    "2. CloudFront GET     ->",
    cf.status,
    `content-type=${cf.headers.get("content-type")}`,
    cfText.trim() === bodyText ? "BODY OK" : `BODY MISMATCH(${cfText})`,
  );

  // 3. direct S3 must be blocked
  const region = env.S3_REGION;
  const direct = `https://${env.S3_BUCKET}.s3.${region}.amazonaws.com/${key}`;
  const d = await fetch(direct);
  console.log("3. direct S3 GET      ->", d.status, d.status === 403 ? "BLOCKED OK" : "NOT BLOCKED!");

  // 4. metadata / exists / range
  const meta = await readObjectMetadata(key);
  console.log("4. HeadObject         ->", `type=${meta.contentType} size=${meta.size}`);
  console.log("   objectExists       ->", await objectExists(key));
  const ranged = await getObjectBody(key, "bytes=0-4");
  console.log("   getObjectBody range->", `content-range=${ranged.contentRange}`);
  ranged.body.destroy();

  // cleanup
  await deleteObject(key);
  console.log("5. deleteObject       -> done; exists now:", await objectExists(key));
  console.log("\nCDN base:", env.S3_ACCESS_URL, "| bucket:", env.S3_BUCKET, "| region:", region);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error("VERIFY FAILED:", err);
    process.exit(1);
  },
);
