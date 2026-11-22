import type { BriefDraft, CreatorCard, Format, MatchCard, RateFit } from "@/shared/contracts";
import { topicDisplayName } from "@/shared/topics";
import { listedCards } from "../creators/directory";
import { one, type Db } from "../db/db";
import { invalidState } from "../http/errors";
import { suggestAngle } from "./angles";
import { campaignBudget } from "./budget";
import { ownedCampaignRow } from "./campaigns";

const RATE_RANK: Record<RateFit, number> = { WITHIN_PREFERENCE: 0, UNKNOWN: 1, ABOVE_PREFERENCE: 2 };
const usd = (c: number) => `$${(c / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

/** Known rate within the cap > unknown > above. Judged on the creator's minimum (spec §4). */
export function rateFit(card: CreatorCard, capCents: number): RateFit {
  if (!card.rate) return "UNKNOWN";
  return card.rate.minCents <= capCents ? "WITHIN_PREFERENCE" : "ABOVE_PREFERENCE";
}

type Scored = { card: MatchCard; formatOverlap: number };

/** Score one listed creator against a brief, or null for zero topic overlap. */
export function scoreCreator(card: CreatorCard, brief: BriefDraft, capCents: number, productName: string, campaignVersion: number): Scored | null {
  const matched = card.topics.filter((t) => brief.topics.includes(t.value));
  if (brief.topics.length === 0 || matched.length === 0) return null;
  const topicMatchPct = Math.round((100 * matched.length) / brief.topics.length);
  const overlapping = card.formats.filter((f) => brief.formats.includes(f.value as Format));
  const formatMatch = brief.formats.length === 0 || overlapping.length > 0;
  const fit = rateFit(card, capCents);
  const evidenceById = new Map(card.evidence.map((e) => [e.id, e]));

  const reasons: MatchCard["reasons"] = [];
  for (const t of matched) {
    const ev = t.evidenceIds.map((id) => evidenceById.get(id)).filter((e) => !!e);
    const src = ev[0] ? ` — “${ev[0].title}”` : t.origin === "CREATOR" ? " (creator-reported)" : "";
    reasons.push({ text: `Covers ${topicDisplayName(t.value).toLowerCase()}${src}`, evidenceIds: ev.map((e) => e.id) });
  }
  for (const f of overlapping) {
    reasons.push({ text: `Makes ${f.value.toLowerCase()} videos`, evidenceIds: f.evidenceIds.filter((id) => evidenceById.has(id)) });
  }
  if (card.rate) {
    const range = `${usd(card.rate.minCents)}–${usd(card.rate.maxCents)}`;
    reasons.push({
      text: fit === "WITHIN_PREFERENCE" ? `Rate ${range} starts within ${usd(capCents)}` : `Rate ${range} starts above ${usd(capCents)}`,
      evidenceIds: [],
    });
  }
  if (card.typical7dViews !== null) {
    const label = card.dataMode === "SAMPLE" ? "sample" : "self-reported";
    reasons.push({ text: `Typically ${card.typical7dViews.toLocaleString("en-US")} views in 7 days (${label})`, evidenceIds: [] });
  }

  const angleFormat = (overlapping[0]?.value ?? card.formats[0]?.value ?? null) as Format | null;
  return {
    formatOverlap: overlapping.length,
    card: {
      creator: card,
      topicMatchPct,
      formatMatch,
      rateFit: fit,
      reasons,
      // Matched topics first (they name the angle); the creator's other topics can still pick the sound-test template.
      angle: suggestAngle({ format: angleFormat, topics: [...new Set([...matched, ...card.topics].map((t) => t.value))], productName }),
      campaignVersion,
    },
  };
}

/** Rank: topic %, format overlap, rate fit, typical 7-day views (known first, higher first), then creator ID. */
export function rank(items: Scored[]): MatchCard[] {
  return items
    .sort((a, b) => {
      const x = a.card;
      const y = b.card;
      return (
        y.topicMatchPct - x.topicMatchPct ||
        b.formatOverlap - a.formatOverlap ||
        RATE_RANK[x.rateFit] - RATE_RANK[y.rateFit] ||
        (y.creator.typical7dViews ?? -1) - (x.creator.typical7dViews ?? -1) ||
        (x.creator.id < y.creator.id ? -1 : x.creator.id > y.creator.id ? 1 : 0)
      );
    })
    .map((s) => s.card);
}

/** GET /campaigns/{id}/matches — computed from current LISTED profiles at request time. */
export function campaignMatches(db: Db, brandId: string, campaignId: string): MatchCard[] {
  const c = ownedCampaignRow(db, brandId, campaignId);
  if (c.status !== "ACTIVE" || !c.brief_json) throw invalidState("Confirm the campaign to see matches.");
  const brief = JSON.parse(c.brief_json) as BriefDraft;
  const budget = campaignBudget(db, c.id, c.budget_cents);
  const remaining = Math.max(0, budget?.remainingCents ?? 0);
  const cap = c.preferred_max_cents !== null ? Math.min(remaining, c.preferred_max_cents) : remaining;
  const product = one<{ name: string }>(db, "SELECT name FROM products WHERE id = ?", c.product_id)!;
  const scored = listedCards(db)
    .map((card) => scoreCreator(card, brief, cap, product.name, c.version))
    .filter((s): s is Scored => s !== null);
  return rank(scored);
}
