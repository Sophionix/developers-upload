/**
 * Report (and optionally rewrite) any card/avatar URLs still pointing at
 * Firebase, converting the object key to a CloudFront URL. Voice notes store a
 * bare key and need no change.
 *
 * Dry run (default): node --env-file=.env node_modules/tsx/dist/cli.mjs scripts/check-db-storage-urls.ts
 * Apply:             ... scripts/check-db-storage-urls.ts --apply
 *
 * Point DATABASE_URL at the target DB (e.g. prod) before running.
 */
import { prisma } from "@/lib/db";
import { publicUrl } from "@/lib/s3";

const APPLY = process.argv.includes("--apply");

// Firebase public URL -> object key. e.g.
// https://firebasestorage.googleapis.com/v0/b/<bucket>/o/admin%2Fcard%2Fx.png?alt=media
function firebaseUrlToKey(url: string): string | null {
  const m = /\/o\/([^?]+)/.exec(url);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]!);
  } catch {
    return null;
  }
}

function isFirebase(v: string | null): v is string {
  return !!v && /firebasestorage\.googleapis\.com|firebasestorage\.app|storage\.googleapis\.com/.test(v);
}

async function main() {
  const cards = await prisma.card.findMany({
    where: { imageUrl: { not: null } },
    select: { id: true, imageUrl: true },
  });
  const users = await prisma.user.findMany({
    where: { avatarUrl: { not: null } },
    select: { id: true, avatarUrl: true },
  });

  const cardHits = cards.filter((c) => isFirebase(c.imageUrl));
  const userHits = users.filter((u) => isFirebase(u.avatarUrl));

  console.log(`cards with imageUrl: ${cards.length}, firebase-hosted: ${cardHits.length}`);
  console.log(`users with avatarUrl: ${users.length}, firebase-hosted: ${userHits.length}`);

  for (const c of cardHits) {
    const key = firebaseUrlToKey(c.imageUrl!);
    if (!key) { console.log("  card", c.id, "UNPARSEABLE", c.imageUrl); continue; }
    const next = publicUrl(key);
    console.log(`  card ${c.id}: -> ${next}`);
    if (APPLY) await prisma.card.update({ where: { id: c.id }, data: { imageUrl: next } });
  }
  for (const u of userHits) {
    const key = firebaseUrlToKey(u.avatarUrl!);
    if (!key) { console.log("  user", u.id, "UNPARSEABLE", u.avatarUrl); continue; }
    const next = publicUrl(key);
    console.log(`  user ${u.id}: -> ${next}`);
    if (APPLY) await prisma.user.update({ where: { id: u.id }, data: { avatarUrl: next } });
  }

  console.log(APPLY ? "\nAPPLIED." : "\nDRY RUN — re-run with --apply to write changes.");
}

main().then(
  () => process.exit(0),
  (err) => { console.error("CHECK FAILED:", err?.message ?? err); process.exit(1); },
);
