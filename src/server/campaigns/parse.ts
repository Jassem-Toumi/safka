import type { BriefDraft, Format, Objective, ParseResult } from "@/shared/contracts";
import { TOPIC_KEYWORDS, FORMAT_KEYWORDS } from "../youcom/extract";

/** Extra brief-only topic phrases on top of the evidence keyword map. */
const BRIEF_TOPIC_KEYWORDS: [string, RegExp][] = [
  ["mechanical-keyboards", /\bkeyboards?\b/i],
  ["desk-setups", /\bdesk (mat|accessor|setup)/i],
];

const OBJECTIVE_KEYWORDS: [Objective, RegExp][] = [
  ["SALES", /\bsales\b|\bsell\b|purchase|conversions?|\bbuy\b|orders?/i],
  ["TRAFFIC", /\btraffic\b|\bclicks?\b|visits?|landing page|sign-?ups?/i],
  ["AWARENESS", /awareness|\blaunch\b|\breach\b|get the word out|visibility/i],
  ["CONTENT", /\bcontent\b|footage|ugc|assets/i],
];

const MONEY_RE = /\$\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?\s?(k\b)?/gi;
const PER_POST_RE = /^\s*(?:\/|per|a|each|max(?:imum)? per)\s*(?:post|video|creator|deal)|^\s*each\b/i;
const PER_POST_BEFORE_RE = /(?:up to|max(?:imum)?|no more than|at most|cap of)\s*$/i;

function toCents(whole: string, frac: string | undefined, k: string | undefined): number {
  const dollars = Number(whole.replace(/,/g, "")) + (frac ? Number(frac.padEnd(2, "0")) / 100 : 0);
  return Math.round(dollars * (k ? 1000 : 1) * 100);
}

function count(prompt: string, unit: RegExp): number | null {
  const re = new RegExp(`(\\d{1,3}(?:,\\d{3})+|\\d+(?:\\.\\d+)?)\\s?(k\\b)?\\s*(?:${unit.source})`, "i");
  const m = prompt.match(re);
  if (!m) return null;
  const n = Math.round(Number(m[1]!.replace(/,/g, "")) * (m[2] ? 1000 : 1));
  return n > 0 ? n : null;
}

/**
 * RULES-mode brief suggestion (spec §4): explicitly written dollar amounts, known topics/formats from the prompt and
 * product text, goal from the prompt and title from the product. Anything unknown stays blank for the brand to review.
 */
export function parseBriefRules(product: { name: string; description: string }, prompt: string): ParseResult {
  let budgetCents: number | null = null;
  let preferredMaxPerPostCents: number | null = null;
  for (const m of prompt.matchAll(MONEY_RE)) {
    const cents = toCents(m[1]!, m[2], m[3]);
    if (cents <= 0) continue;
    const after = prompt.slice(m.index! + m[0].length, m.index! + m[0].length + 24);
    const before = prompt.slice(Math.max(0, m.index! - 24), m.index!);
    if (PER_POST_RE.test(after) || PER_POST_BEFORE_RE.test(before)) preferredMaxPerPostCents ??= cents;
    else budgetCents ??= cents;
  }

  const text = `${prompt}\n${product.name}\n${product.description}`;
  const topics = [...TOPIC_KEYWORDS, ...BRIEF_TOPIC_KEYWORDS].filter(([, re]) => re.test(text)).map(([t]) => t);
  const formats: Format[] = FORMAT_KEYWORDS.filter(([, re]) => re.test(prompt)).map(([f]) => f);
  // The objective whose keyword appears first in the prompt wins.
  const objective =
    OBJECTIVE_KEYWORDS.map(([o, re]) => [o, prompt.search(re)] as const)
      .filter(([, i]) => i >= 0)
      .sort((a, b) => a[1] - b[1])[0]?.[0] ?? null;

  const brief: BriefDraft = {
    title: product.name.slice(0, 80),
    goal: prompt.trim().slice(0, 1500),
    objective,
    topics: [...new Set(topics)].slice(0, 8),
    formats: [...new Set(formats)],
    talkingPoints: [],
    restrictions: [],
  };
  return {
    brief,
    budgetCents,
    preferredMaxPerPostCents,
    defaultViewTarget: count(prompt, /views?\b/),
    defaultClickTarget: count(prompt, /clicks?\b/),
    mode: "RULES",
  };
}
