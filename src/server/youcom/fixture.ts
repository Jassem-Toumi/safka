import type { ChannelIdentity } from "../creators/channel";
import type { SearchHit } from "./client";

/**
 * Deterministic offline results for YDC_MODE=fixture. URLs point at example.com and every title says "(sample)",
 * so fixture data can never be mistaken for a live source. One result deliberately lacks the handle to show
 * identity filtering.
 */
export function fixtureSearch(channel: ChannelIdentity): SearchHit[] {
  const slug = channel.display.replace(/^@/, "").toLowerCase();
  const base = `https://example.com/sample-search/${encodeURIComponent(slug)}`;
  return [
    {
      url: `${base}/quiet-switch-sound-test`,
      title: "Quiet linear switches sound test (sample)",
      snippet: `Sample result. ${channel.display} compares stock and lubed switches side by side in a keyboard sound test.`,
      publishedAt: null,
    },
    {
      url: `${base}/budget-keyboard-review`,
      title: "Budget mechanical keyboard review (sample)",
      snippet: `Sample result. ${channel.display} reviews a budget 75% mechanical keyboard after two weeks of daily typing.`,
      publishedAt: null,
    },
    {
      url: `${base}/desk-setup-tour`,
      title: "Small desk setup tour (sample)",
      snippet: `Sample result. A desk setup tour from ${channel.display} with a felt mat and a compact keyboard.`,
      publishedAt: null,
    },
    {
      url: "https://example.com/sample-search/unrelated/similar-name",
      title: "A different channel with a similar name (sample)",
      snippet: "Sample result. Similar display name, different channel — must not be attributed.",
      publishedAt: null,
    },
  ];
}
