import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { requireUser, UnauthorizedError } from "@/lib/auth/guards";
import { errJson, getRequestId, rateLimitedJson } from "@/lib/http";
import { withRequestId } from "@/lib/logger";

export const runtime = "nodejs";

const BATCH_SIZE = 50;

function fmtDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeCsv(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

async function streamPdf(userId: string): Promise<ReadableStream<Uint8Array>> {
  const { default: PDFDocument } = await import("pdfkit");
  const doc = new PDFDocument({ margin: 50, size: "A4", bufferPages: false });

  const { readable, writable } = new TransformStream<Uint8Array>();
  const writer = writable.getWriter();

  doc.on("data", (chunk: Buffer) => {
    writer.write(new Uint8Array(chunk)).catch(() => {});
  });
  doc.on("end", () => {
    writer.close().catch(() => {});
  });
  doc.on("error", () => {
    writer.abort().catch(() => {});
  });

  (async () => {
    doc
      .fontSize(22)
      .font("Helvetica-Bold")
      .text("Journal Export", { align: "center" });
    doc
      .fontSize(10)
      .font("Helvetica")
      .text(`Exported on ${fmtDate(new Date())}`, { align: "center" });
    doc.moveDown(2);

    let cursor: string | undefined;
    let entryIndex = 0;
    let hasMore = true;

    while (hasMore) {
      const batch = await prisma.journalEntry.findMany({
        where: { userId, deletedAt: null, isDraft: false },
        select: {
          id: true,
          title: true,
          bodyHtml: true,
          bodyPlain: true,
          createdAt: true,
          moodCheckIn: { select: { mood: true, note: true } },
          tags: { select: { tag: { select: { name: true } } } },
        },
        orderBy: { createdAt: "desc" },
        take: BATCH_SIZE,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      });

      if (batch.length < BATCH_SIZE) hasMore = false;
      if (batch.length === 0) break;
      cursor = batch[batch.length - 1]!.id;

      for (const entry of batch) {
        if (entryIndex > 0) {
          doc.addPage();
        }

        doc.fontSize(14).font("Helvetica-Bold");
        doc.text(entry.title ?? "Untitled", { align: "left" });

        doc.fontSize(9).font("Helvetica").fillColor("#888888");
        doc.text(fmtDate(entry.createdAt));

        if (entry.moodCheckIn) {
          doc.text(`Mood: ${entry.moodCheckIn.mood}${entry.moodCheckIn.note ? ` — ${entry.moodCheckIn.note}` : ""}`);
        }

        const tagNames = entry.tags.map((t) => t.tag.name);
        if (tagNames.length > 0) {
          doc.text(`Tags: ${tagNames.join(", ")}`);
        }

        doc.fillColor("#000000").moveDown(0.5);

        const body = entry.bodyPlain?.trim() || stripHtml(entry.bodyHtml);
        doc.fontSize(11).font("Helvetica");
        doc.text(body, { align: "left", lineGap: 2 });

        entryIndex++;
      }
    }

    if (entryIndex === 0) {
      doc.fontSize(12).font("Helvetica").text("No journal entries found.");
    }

    doc.end();
  })();

  return readable;
}

async function streamCsv(userId: string): Promise<ReadableStream<Uint8Array>> {
  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream<Uint8Array>();
  const writer = writable.getWriter();

  (async () => {
    await writer.write(
      encoder.encode("Title,Date,Mood,Mood Note,Tags,Body\n"),
    );

    let cursor: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const batch = await prisma.journalEntry.findMany({
        where: { userId, deletedAt: null, isDraft: false },
        select: {
          id: true,
          title: true,
          bodyPlain: true,
          createdAt: true,
          moodCheckIn: { select: { mood: true, note: true } },
          tags: { select: { tag: { select: { name: true } } } },
        },
        orderBy: { createdAt: "desc" },
        take: BATCH_SIZE,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      });

      if (batch.length < BATCH_SIZE) hasMore = false;
      if (batch.length === 0) break;
      cursor = batch[batch.length - 1]!.id;

      for (const entry of batch) {
        const row = [
          escapeCsv(entry.title ?? "Untitled"),
          escapeCsv(fmtDate(entry.createdAt)),
          escapeCsv(entry.moodCheckIn?.mood ?? ""),
          escapeCsv(entry.moodCheckIn?.note ?? ""),
          escapeCsv(entry.tags.map((t) => t.tag.name).join("; ")),
          escapeCsv(entry.bodyPlain),
        ].join(",");
        await writer.write(encoder.encode(row + "\n"));
      }
    }

    await writer.close();
  })();

  return readable;
}

export async function GET(req: Request): Promise<Response> {
  const requestId = getRequestId(req);
  const log = withRequestId(requestId);

  let user;
  try {
    user = await requireUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return errJson("UNAUTHORIZED", 401);
    }
    throw e;
  }

  const rl = await rateLimit({ key: `journal-export:${user.id}`, limit: 5, windowSec: 60 });
  if (!rl.ok) return rateLimitedJson(rl.resetAt);

  const url = new URL(req.url);
  const format = url.searchParams.get("format")?.toUpperCase() === "CSV" ? "CSV" : "PDF";
  const now = new Date().toISOString().slice(0, 10);

  log.info({ userId: user.id, format }, "journal_export_start");

  if (format === "CSV") {
    const stream = await streamCsv(user.id);
    return new Response(stream, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="journal-${now}.csv"`,
        "X-Request-Id": requestId,
      },
    });
  }

  const stream = await streamPdf(user.id);
  return new Response(stream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="journal-${now}.pdf"`,
      "X-Request-Id": requestId,
    },
  });
}
