import { type NextRequest, NextResponse } from "next/server";
import type { Readable } from "node:stream";
import { requireUser, UnauthorizedError } from "@/lib/auth/guards";
import { errJson } from "@/lib/http";
import {
  getObjectBody,
  isStorageConfigured,
  objectExists,
} from "@/lib/storage";

export const runtime = "nodejs";

function toWebStream(nodeStream: Readable): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      nodeStream.on("data", (chunk: Buffer) => controller.enqueue(chunk));
      nodeStream.on("end", () => controller.close());
      nodeStream.on("error", (err) => controller.error(err));
    },
    cancel() {
      nodeStream.destroy();
    },
  });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
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

  // Enforce ownership — path must be under this user's prefix. This is why the
  // audio is proxied through the server rather than served from the public CDN.
  const requiredPrefix = `users/${user.id}/voice-notes/`;
  if (!path.startsWith(requiredPrefix)) return errJson("FORBIDDEN", 403);

  if (!isStorageConfigured()) return errJson("STORAGE_NOT_CONFIGURED", 503);

  try {
    if (!(await objectExists(path))) return errJson("NOT_FOUND", 404);

    const rangeHeader = req.headers.get("range") ?? undefined;
    const obj = await getObjectBody(path, rangeHeader);
    const body = toWebStream(obj.body);

    // S3 echoes Content-Range for a satisfiable range request → 206.
    if (rangeHeader && obj.contentRange) {
      return new NextResponse(body, {
        status: 206,
        headers: {
          "Content-Type": obj.contentType,
          "Content-Range": obj.contentRange,
          "Accept-Ranges": "bytes",
          ...(obj.contentLength !== undefined
            ? { "Content-Length": String(obj.contentLength) }
            : {}),
          "Cache-Control": "private, max-age=3600",
        },
      });
    }

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": obj.contentType,
        "Accept-Ranges": "bytes",
        ...(obj.contentLength !== undefined
          ? { "Content-Length": String(obj.contentLength) }
          : {}),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    const name = (err as { name?: string })?.name;
    if (name === "NoSuchKey" || name === "NotFound")
      return errJson("NOT_FOUND", 404);
    return errJson("INTERNAL_ERROR", 500);
  }
}
