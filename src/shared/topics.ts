/** Topic slug rules shared by frontend preview and server validation. */

export function normalizeTopic(raw: string): string {
  return raw
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Normalize, drop empties, dedupe (order preserved). */
export function normalizeTopics(raw: readonly string[]): string[] {
  const out: string[] = [];
  for (const t of raw) {
    const s = normalizeTopic(t);
    if (s && !out.includes(s)) out.push(s);
  }
  return out;
}

/** "mechanical-keyboards" → "Mechanical keyboards" */
export function topicDisplayName(slug: string): string {
  const s = slug.replace(/-/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}
