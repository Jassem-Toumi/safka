import type { CreatorCard, CreatorDirectoryQuery } from "@/shared/contracts";
import { normalizeTopic } from "@/shared/topics";
import { all, one, type Db } from "../db/db";
import { notFound } from "../http/errors";

/** Published cards of every LISTED profile, sorted by display name then ID. */
export function listedCards(db: Db): CreatorCard[] {
  const rows = all<{ id: string; published_json: string }>(
    db,
    "SELECT id, published_json FROM creator_profiles WHERE visibility = 'LISTED' AND published_json IS NOT NULL",
  );
  return rows.map((r) => JSON.parse(r.published_json) as CreatorCard).sort(byNameThenId);
}

export function byNameThenId(a: CreatorCard, b: CreatorCard): number {
  const n = a.displayName.localeCompare(b.displayName, "en", { sensitivity: "base" });
  if (n !== 0) return n;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function searchDirectory(db: Db, q: CreatorDirectoryQuery): CreatorCard[] {
  const text = q.q?.toLowerCase();
  const topic = q.topic ? normalizeTopic(q.topic) : undefined;
  let cards = listedCards(db).filter(
    (c) =>
      (!text || c.displayName.toLowerCase().includes(text) || c.bio.toLowerCase().includes(text)) &&
      (!topic || c.topics.some((t) => t.value === topic)) &&
      (!q.format || c.formats.some((f) => f.value === q.format)),
  );
  if (q.limit) cards = cards.slice(0, q.limit);
  return cards;
}

export function listedCard(db: Db, profileId: string): CreatorCard {
  const row = one<{ published_json: string | null }>(
    db,
    "SELECT published_json FROM creator_profiles WHERE id = ? AND visibility = 'LISTED'",
    profileId,
  );
  if (!row?.published_json) throw notFound("Creator");
  return JSON.parse(row.published_json) as CreatorCard;
}
