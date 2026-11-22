import { describe, expect, it } from "vitest";
import { normalizeChannel } from "@/server/creators/channel";

describe("normalizeChannel", () => {
  it.each([
    ["@ClackLab", "https://www.youtube.com/@ClackLab", "yt:@clacklab"],
    ["youtube.com/@ClackLab", "https://www.youtube.com/@ClackLab", "yt:@clacklab"],
    ["https://www.youtube.com/@ClackLab/videos?si=abc#top", "https://www.youtube.com/@ClackLab", "yt:@clacklab"],
    ["http://m.youtube.com/@ClackLab/", "https://www.youtube.com/@ClackLab", "yt:@clacklab"],
    ["https://youtube.com/channel/UC1234567890abcdefghij12", "https://www.youtube.com/channel/UC1234567890abcdefghij12", "yt:UC1234567890abcdefghij12"],
  ])("normalizes %s", (input, url, key) => {
    const r = normalizeChannel(input)!;
    expect(r.url).toBe(url);
    expect(r.key).toBe(key);
  });

  it.each([
    "",
    "ClackLab",
    "https://youtube.com.evil.com/@ClackLab",
    "https://evil.com/@ClackLab",
    "https://www.youtube.com/watch?v=abcdefghijk",
    "https://www.youtube.com/c/ClackLab",
    "https://www.youtube.com/@ClackLab/videos/extra",
    "https://user:pw@www.youtube.com/@ClackLab",
    "https://www.youtube.com/channel/UCshort",
    "@a",
    "ftp://youtube.com/@ClackLab",
  ])("rejects %s", (input) => {
    expect(normalizeChannel(input)).toBeNull();
  });
});
