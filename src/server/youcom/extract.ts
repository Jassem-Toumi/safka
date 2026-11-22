import type { Format } from "@/shared/contracts";
import type { ChannelIdentity } from "../creators/channel";
import type { SearchHit } from "./client";

export type ExtractedHit = SearchHit & { excerpt: string; topics: string[]; formats: Format[] };

const MAX_RESULTS = 6;
const EXCERPT_LEN = 280;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Identity is established only by the exact handle or channel ID appearing in the result URL or snippet
 * (which covers explicit channel links). Similar display names never count.
 */
export function matchesIdentity(hit: SearchHit, channel: ChannelIdentity): boolean {
  const hay = `${hit.url} ${hit.title} ${hit.snippet}`;
  if (channel.kind === "channelId") {
    return new RegExp(`(?<![A-Za-z0-9_-])${escape(channel.display)}(?![A-Za-z0-9_-])`).test(hay);
  }
  const handle = channel.display; // "@Handle"
  // A trailing "." ends a sentence unless another handle character follows it.
  return new RegExp(`${escape(handle)}(?![A-Za-z0-9_-]|\\.[A-Za-z0-9_-])`, "i").test(hay);
}

/** Small keyword map over titles and snippets (spec §3.3). Unknown terms are left for manual tags. */
export const TOPIC_KEYWORDS: [string, RegExp][] = [
  ["mechanical-keyboards", /mechanical keyboard|keyboard build|custom keyboard|keycaps?|\bswitch(es)?\b|\bthock|\b(60|65|75|tkl)\s?%?\s?keyboard/i],
  ["keyboard-sound-tests", /sound test|typing sounds?|typing asmr/i],
  ["keyboard-mods", /\blube[ds]?\b|\blubing\b|foam mod|tape mod|keyboard mods?|\bmodd(ed|ing)\b/i],
  ["desk-setups", /desk setup|setup tour|battlestation|desk tour/i],
  ["home-office", /home office|work from home|\bwfh\b/i],
  ["productivity", /productivity|workflow/i],
  ["smartphones", /smartphone|\biphone\b|\bandroid\b|\bpixel \d|galaxy s\d/i],
  ["tech-news", /tech news/i],
  ["audio", /headphones?|earbuds|\bspeakers?\b|\bdac\b/i],
  ["gaming", /\bgaming\b/i],
  ["cameras", /\bcamera\b|\blens(es)?\b/i],
];

export const FORMAT_KEYWORDS: [Format, RegExp][] = [
  ["REVIEW", /\breviews?\b|\breviewed\b/i],
  ["COMPARISON", /\bvs\.?\b|\bversus\b|compar(ed|ison|ing)|side[- ]by[- ]side|sound test/i],
  ["DEMO", /\bdemo\b|demonstrat|in action|sound test|hands[- ]on/i],
  ["TUTORIAL", /how to|tutorial|step[- ]by[- ]step|\bguide\b/i],
  ["UNBOXING", /unbox/i],
  ["STORY", /\bvlog\b|my story|journey|day in the life/i],
];

export function tagText(text: string): { topics: string[]; formats: Format[] } {
  return {
    topics: TOPIC_KEYWORDS.filter(([, re]) => re.test(text)).map(([t]) => t),
    formats: FORMAT_KEYWORDS.filter(([, re]) => re.test(text)).map(([f]) => f),
  };
}

function excerptOf(snippet: string, title: string): string {
  const s = (snippet || title).replace(/\s+/g, " ").trim();
  if (s.length <= EXCERPT_LEN) return s;
  const cut = s.slice(0, EXCERPT_LEN);
  return `${cut.slice(0, cut.lastIndexOf(" ") > 200 ? cut.lastIndexOf(" ") : EXCERPT_LEN).trim()}…`;
}

/** Keep up to six identity-matched results, deduped by URL, with candidate tags. */
export function extract(hits: SearchHit[], channel: ChannelIdentity): ExtractedHit[] {
  const out: ExtractedHit[] = [];
  const seen = new Set<string>();
  for (const h of hits) {
    if (out.length >= MAX_RESULTS) break;
    if (!h.url || seen.has(h.url) || !matchesIdentity(h, channel)) continue;
    seen.add(h.url);
    const tags = tagText(`${h.title} ${h.snippet}`);
    out.push({ ...h, title: h.title.slice(0, 300) || h.url, excerpt: excerptOf(h.snippet, h.title), ...tags });
  }
  return out;
}

export function searchQuery(channel: ChannelIdentity): string {
  return `site:youtube.com "${channel.display}" videos reviews demonstrations`;
}
