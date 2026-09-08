import { NextResponse } from "next/server";
import { requireUser, UnauthorizedError } from "@/lib/auth/guards";
import { errJson } from "@/lib/http";
import { issueDownloadUrl, isStorageConfigured } from "@/lib/storage";

export async function GET(req: Request): Promise<NextResponse> {
  let user;
  try {
    user = await requireUser();
  } catch (err) {
    if (err instanceof UnauthorizedError) return errJson("UNAUTHORIZED", 401);
    throw err;
  }

  const { searchParams } = new URL(req.url);
  const path = searchParams.get("path");
  if (!path) return errJson("MISSING_PATH", 400);

  const requiredPrefix = `users/${user.id}/voice-notes/`;
  if (!path.startsWith(requiredPrefix)) return errJson("FORBIDDEN", 403);

  if (!isStorageConfigured()) return errJson("STORAGE_NOT_CONFIGURED", 503);

  try {
    const { url } = await issueDownloadUrl(path, 3600);
    return NextResponse.json({ ok: true, url });
  } catch {
    return errJson("INTERNAL_ERROR", 500);
  }
}
