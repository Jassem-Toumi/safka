/** YouTube channel identity normalization (spec-final §3.1). */

export type ChannelIdentity = {
  kind: "handle" | "channelId";
  /** Uniqueness key: yt:@lowercasehandle or yt:UC… */
  key: string;
  /** Canonical HTTPS URL. */
  url: string;
  /** Display form: @Handle or UC… */
  display: string;
};

const HANDLE_RE = /^[A-Za-z0-9._-]{3,30}$/;
const CHANNEL_ID_RE = /^UC[A-Za-z0-9_-]{22}$/;
const HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com"]);
const TABS = new Set(["", "videos", "shorts", "streams", "featured", "about", "playlists", "community", "podcasts"]);

export function normalizeChannel(input: string): ChannelIdentity | null {
  const raw = input.trim();
  if (!raw) return null;

  if (raw.startsWith("@")) return fromHandle(raw.slice(1));

  let url: URL;
  try {
    url = new URL(/^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password || url.port) return null;
  if (!HOSTS.has(url.hostname.toLowerCase())) return null;

  // Query string and fragment are dropped (tracking params, etc.).
  const parts = url.pathname.split("/").filter(Boolean);
  const [first, second, third, ...rest] = parts;
  if (!first || rest.length > 0) return null;

  if (first.startsWith("@")) {
    if (third !== undefined) return null;
    if (!TABS.has((second ?? "").toLowerCase())) return null;
    return fromHandle(decodeURIComponent(first.slice(1)));
  }
  if (first === "channel" && second) {
    if (!TABS.has((third ?? "").toLowerCase())) return null;
    return fromChannelId(second);
  }
  return null;
}

function fromHandle(h: string): ChannelIdentity | null {
  if (!HANDLE_RE.test(h)) return null;
  return { kind: "handle", key: `yt:@${h.toLowerCase()}`, url: `https://www.youtube.com/@${h}`, display: `@${h}` };
}

function fromChannelId(id: string): ChannelIdentity | null {
  if (!CHANNEL_ID_RE.test(id)) return null;
  return { kind: "channelId", key: `yt:${id}`, url: `https://www.youtube.com/channel/${id}`, display: id };
}
