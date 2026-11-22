/**
 * Splits typed text on commas and newlines into trimmed, non-empty items,
 * dropping case-insensitive repeats and keeping the first spelling.
 */
export function splitList(text: string): string[] {
	const seen = new Set<string>();
	const items: string[] = [];

	for (const raw of text.split(/[,\n]/)) {
		const item = raw.trim();
		const key = item.toLowerCase();

		if (item === "" || seen.has(key)) {
			continue;
		}

		seen.add(key);
		items.push(item);
	}

	return items;
}
