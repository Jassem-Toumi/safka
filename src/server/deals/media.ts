import { createReadStream, existsSync, mkdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Readable } from "node:stream";
import { UPLOAD_LIMITS, type UploadResult } from "@/shared/contracts";
import { one, run, tx, type Db } from "../db/db";
import { nowIso } from "../clock";
import type { SessionUser } from "../http/auth";
import { ApiError, invalidState, notFound } from "../http/errors";
import { newId } from "../ids";
import { uploadsDir } from "../seed/seed";
import { accessibleDeal } from "./view";

const UPLOAD_STATES = ["AGREED", "REVISION_REQUESTED"];

function tooLarge() {
  return new ApiError("PAYLOAD_TOO_LARGE", `Videos can be up to ${UPLOAD_LIMITS.maxBytes / 1024 / 1024} MiB.`);
}

/** MP4/ISO-BMFF: bytes 4..7 are "ftyp". */
export function looksLikeMp4(head: Uint8Array): boolean {
  return head.length >= 12 && head[4] === 0x66 && head[5] === 0x74 && head[6] === 0x79 && head[7] === 0x70;
}

function checkUploadAllowed(db: Db, user: SessionUser, dealId: string) {
  const { row, role } = accessibleDeal(db, user, dealId);
  if (role !== "CREATOR") throw new ApiError("FORBIDDEN", "Only the deal's creator can upload drafts.");
  if (!UPLOAD_STATES.includes(row.status)) throw invalidState("Drafts can be uploaded after agreement or when changes are requested.");
  const n = one<{ n: number }>(db, "SELECT COUNT(*) AS n FROM uploads WHERE deal_id = ? AND status = 'READY'", dealId)!.n;
  if (n >= UPLOAD_LIMITS.maxUnattachedPerDeal) throw invalidState(`Up to ${UPLOAD_LIMITS.maxUnattachedPerDeal} unattached uploads per deal. Submit or wait.`);
}

/**
 * POST /deals/{id}/uploads (multipart `file`). File IO happens outside the transaction; the row is inserted in a short
 * transaction that re-checks state, and the file is deleted if that fails.
 */
export async function handleUpload(db: Db, user: SessionUser, dealId: string, req: Request): Promise<UploadResult> {
  checkUploadAllowed(db, user, dealId);
  const declared = Number(req.headers.get("content-length") || "0");
  if (declared > UPLOAD_LIMITS.maxBytes + 64 * 1024) throw tooLarge();
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new ApiError("VALIDATION_ERROR", "Send multipart/form-data with a `file` field.", { file: "Required." });
  }
  const file = form.get("file");
  if (!(file instanceof File)) throw new ApiError("VALIDATION_ERROR", "Attach one MP4 as `file`.", { file: "Required." });
  if (file.size > UPLOAD_LIMITS.maxBytes) throw tooLarge();
  if (file.size === 0) throw new ApiError("VALIDATION_ERROR", "The file is empty.", { file: "Empty file." });
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!looksLikeMp4(bytes.subarray(0, 12))) throw new ApiError("VALIDATION_ERROR", "Only MP4 videos are supported.", { file: "Not an MP4 file." });

  const id = newId();
  const diskKey = `${newId()}.mp4`;
  const dir = uploadsDir();
  mkdirSync(dir, { recursive: true });
  const path = join(dir, diskKey);
  try {
    writeFileSync(path, bytes, { flag: "wx" });
    tx(db, () => {
      checkUploadAllowed(db, user, dealId);
      run(
        db,
        "INSERT INTO uploads (id, deal_id, creator_user_id, disk_key, size_bytes, original_name, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'READY', ?)",
        id,
        dealId,
        user.id,
        diskKey,
        bytes.length,
        file.name.slice(0, 200) || null,
        nowIso(),
      );
    });
  } catch (e) {
    try {
      if (existsSync(path)) unlinkSync(path);
    } catch {
      /* best effort */
    }
    throw e;
  }
  return { uploadId: id, status: "READY", sizeBytes: bytes.length };
}

/** Asset on this deal that the viewer may stream (participants, or admin on a disputed deal). */
export function assetFile(db: Db, user: SessionUser, dealId: string, assetId: string): { path: string } {
  accessibleDeal(db, user, dealId);
  const r = one<{ disk_key: string }>(
    db,
    `SELECT u.disk_key FROM draft_assets a JOIN draft_batches b ON b.id = a.batch_id JOIN uploads u ON u.id = a.upload_id
      WHERE a.id = ? AND b.deal_id = ?`,
    assetId,
    dealId,
  );
  if (!r) throw notFound("Draft");
  return { path: join(uploadsDir(), r.disk_key) };
}

const MEDIA_HEADERS = { "Content-Type": "video/mp4", "Accept-Ranges": "bytes", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

/** Parse a single `bytes=` range. Returns null for "serve whole file", "invalid" for 416. */
export function parseRange(header: string | null, size: number): { start: number; end: number } | null | "invalid" {
  if (!header) return null;
  const m = header.trim().match(/^bytes=(\d*)-(\d*)$/);
  if (!m) return header.includes(",") ? null : "invalid"; // multi-range: fall back to a full 200 response
  const [, a, b] = m;
  if (a === "" && b === "") return "invalid";
  if (a === "") {
    const n = Number(b);
    if (n === 0) return "invalid";
    return { start: Math.max(0, size - n), end: size - 1 };
  }
  const start = Number(a);
  const end = b === "" ? size - 1 : Math.min(Number(b), size - 1);
  if (start >= size || start > end) return "invalid";
  return { start, end };
}

/** Authorized MP4 stream with single-range support (206/416). */
export function streamMedia(path: string, rangeHeader: string | null, method: string): Response {
  if (!existsSync(path)) throw notFound("Video file");
  const size = statSync(path).size;
  const range = parseRange(rangeHeader, size);
  if (range === "invalid") {
    return new Response(null, { status: 416, headers: { ...MEDIA_HEADERS, "Content-Range": `bytes */${size}` } });
  }
  const { start, end } = range ?? { start: 0, end: size - 1 };
  const headers: Record<string, string> = { ...MEDIA_HEADERS, "Content-Length": String(end - start + 1) };
  if (range) headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
  const body = method === "HEAD" ? null : (Readable.toWeb(createReadStream(path, { start, end })) as ReadableStream);
  return new Response(body, { status: range ? 206 : 200, headers });
}
