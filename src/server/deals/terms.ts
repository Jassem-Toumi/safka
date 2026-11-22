import { ApiError } from "../http/errors";

/** now < draftDueAt < publishDueAt (spec §4). */
export function checkDates(now: string, draftDueAt: string, publishDueAt: string) {
  const fields: Record<string, string> = {};
  if (!(draftDueAt > now)) fields.draftDueAt = "Draft due date must be in the future.";
  if (!(publishDueAt > draftDueAt)) fields.publishDueAt = "Publish due date must be after the draft due date.";
  if (Object.keys(fields).length) throw new ApiError("VALIDATION_ERROR", "Check the due dates.", fields);
}

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/** Accepts youtube.com/watch?v=, youtube.com/shorts/<id>, youtu.be/<id>. Returns canonical watch URL + video ID. */
export function parseYouTubeVideo(input: string): { url: string; videoId: string } | null {
  let u: URL;
  try {
    u = new URL(input.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (u.username || u.password || u.port) return null;
  const host = u.hostname.toLowerCase();
  let id: string | null = null;
  if (host === "youtu.be") id = u.pathname.split("/")[1] ?? null;
  else if (["youtube.com", "www.youtube.com", "m.youtube.com"].includes(host)) {
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts[0] === "watch" && parts.length === 1) id = u.searchParams.get("v");
    else if (parts[0] === "shorts" && parts.length === 2) id = parts[1]!;
  }
  if (!id || !VIDEO_ID.test(id)) return null;
  return { url: `https://www.youtube.com/watch?v=${id}`, videoId: id };
}
