import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

/** One normalized web result from you-search. */
export type SearchHit = { url: string; title: string; snippet: string; publishedAt: string | null };

export class YouSearchError extends Error {
  constructor(public readonly code: "TIMEOUT" | "PROVIDER_ERROR" | "BAD_RESPONSE" | "AUTH_FAILED" | "QUOTA_EXCEEDED") {
    super(`you-search failed: ${code}`);
    this.name = "YouSearchError";
  }
}

export const TOTAL_TIMEOUT_MS = 12_000;
const FREE_ENDPOINT = "https://api.you.com/mcp/free";
const KEYED_ENDPOINT = "https://api.you.com/mcp?tools=you-search";

export function endpointInfo(): { url: string; authenticated: boolean } {
  const key = process.env.YDC_API_KEY?.trim();
  return key ? { url: KEYED_ENDPOINT, authenticated: true } : { url: FREE_ENDPOINT, authenticated: false };
}

/**
 * One live `you-search` call over MCP Streamable HTTP. The 12 s budget covers connect + call; the client is always closed.
 * The API key is only placed in the Authorization header and never included in errors or logs.
 */
export async function youSearch(query: string, count = 6, timeoutMs = TOTAL_TIMEOUT_MS): Promise<SearchHit[]> {
  const key = process.env.YDC_API_KEY?.trim();
  const { url } = endpointInfo();
  const abort = new AbortController();
  const transport = new StreamableHTTPClientTransport(new URL(url), {
    requestInit: { headers: key ? { Authorization: `Bearer ${key}` } : {}, signal: abort.signal },
  });
  const client = new Client({ name: "safka-local", version: "0.1.0" });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      abort.abort();
      reject(new YouSearchError("TIMEOUT"));
    }, timeoutMs);
  });
  try {
    const work = (async () => {
      await client.connect(transport);
      const res = await client.callTool({ name: "you-search", arguments: { query, count } }, undefined, { timeout: timeoutMs, signal: abort.signal });
      return res;
    })();
    const res = await Promise.race([work, timeout]);
    work.catch(() => {});
    if (res.isError) throw new YouSearchError(classify(JSON.stringify(res.content ?? "")));
    return parseToolResult(res as { structuredContent?: unknown; content?: unknown }).slice(0, count);
  } catch (e) {
    if (e instanceof YouSearchError) throw e;
    const msg = e instanceof Error ? e.message : "";
    if (abort.signal.aborted) throw new YouSearchError("TIMEOUT");
    throw new YouSearchError(classify(msg));
  } finally {
    clearTimeout(timer);
    await client.close().catch(() => {});
  }
}

function classify(msg: string): YouSearchError["code"] {
  if (/limit exceeded|rate.?limit|\b429\b|quota|upgrade/i.test(msg)) return "QUOTA_EXCEEDED";
  if (/\b(401|403)\b|unauthori[sz]ed|forbidden|invalid api key/i.test(msg)) return "AUTH_FAILED";
  return "PROVIDER_ERROR";
}

type Json = unknown;

/** Accepts the tool's structuredContent or a JSON/text content block and extracts web hits. */
export function parseToolResult(res: { structuredContent?: Json; content?: Json }): SearchHit[] {
  const candidates: Json[] = [];
  if (res.structuredContent) candidates.push(res.structuredContent);
  if (Array.isArray(res.content)) {
    for (const block of res.content as { type?: string; text?: string }[]) {
      if (block?.type === "text" && typeof block.text === "string") {
        try {
          candidates.push(JSON.parse(block.text));
        } catch {
          candidates.push(block.text);
        }
      }
    }
  }
  const hits: SearchHit[] = [];
  const seen = new Set<string>();
  const push = (h: SearchHit | null) => {
    if (h && !seen.has(h.url)) {
      seen.add(h.url);
      hits.push(h);
    }
  };
  for (const c of candidates) {
    if (typeof c === "string") parseText(c).forEach(push);
    else collect(c, push, 0);
  }
  if (candidates.length > 0 && hits.length === 0 && !candidates.some((c) => typeof c === "string" || isObj(c))) {
    throw new YouSearchError("BAD_RESPONSE");
  }
  return hits;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function str(v: unknown): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.filter((x) => typeof x === "string").join(" ");
  return "";
}

function toHit(o: Record<string, unknown>): SearchHit | null {
  const url = str(o.url ?? o.link);
  if (!/^https?:\/\//i.test(url)) return null;
  const title = str(o.title ?? o.name).trim();
  const snippet = [str(o.description), str(o.snippets ?? o.snippet), str(o.content)].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  const date = str(o.page_age ?? o.published_at ?? o.publishedAt ?? o.date);
  const parsed = date ? new Date(date) : null;
  return { url, title, snippet, publishedAt: parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : null };
}

function collect(v: Json, push: (h: SearchHit | null) => void, depth: number) {
  if (depth > 5) return;
  if (Array.isArray(v)) {
    for (const x of v) collect(x, push, depth + 1);
    return;
  }
  if (!isObj(v)) return;
  if (typeof (v.url ?? v.link) === "string") {
    push(toHit(v));
    return;
  }
  for (const x of Object.values(v)) collect(x, push, depth + 1);
}

/** Fallback for a plain-text listing: "Title: …\nURL: …\nDescription/Snippets: …" blocks. */
function parseText(text: string): SearchHit[] {
  const out: SearchHit[] = [];
  for (const block of text.split(/\n\s*\n/)) {
    const url = block.match(/https?:\/\/[^\s)>\]]+/)?.[0];
    if (!url) continue;
    const title = block.match(/^\s*(?:\d+\.\s*)?Title:\s*(.+)$/im)?.[1]?.trim() ?? "";
    const snippet = (block.match(/(?:Description|Snippets?):\s*([\s\S]+)/i)?.[1] ?? "").replace(/\s+/g, " ").trim();
    out.push({ url, title, snippet, publishedAt: null });
  }
  return out;
}
