import { isIP } from "node:net";
import type { Product, ProductInput, ProductPatch } from "@/shared/contracts";
import { all, one, run, type Db } from "../db/db";
import { nowIso } from "../clock";
import { ApiError, notFound } from "../http/errors";
import { newId } from "../ids";

type ProductRow = { id: string; brand_id: string; name: string; description: string; landing_url: string | null; created_at: string; updated_at: string };

const toDto = (r: ProductRow): Product => ({
  id: r.id,
  name: r.name,
  description: r.description,
  landingUrl: r.landing_url,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

function isPrivateIpv4(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number) as [number, number];
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

/** Landing URLs must be public https links: no credentials, no loopback/private IP literals, no localhost names. */
export function checkLandingUrl(value: string | null): string | null {
  if (value === null) return null;
  const bad = (msg: string) => new ApiError("VALIDATION_ERROR", "The landing URL isn't allowed.", { landingUrl: msg });
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw bad("Not a valid URL.");
  }
  if (url.protocol !== "https:") throw bad("Must be an https:// URL.");
  if (url.username || url.password) throw bad("URLs with credentials aren't allowed.");
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || !host.includes(".") && !isIP(host)) {
    throw bad("Use a public website address.");
  }
  const kind = isIP(host);
  if (kind === 4 && isPrivateIpv4(host)) throw bad("Private or loopback addresses aren't allowed.");
  if (kind === 6) {
    const mapped = host.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
    if (mapped ? isPrivateIpv4(mapped) : /^(::1?$|f[cd]|fe[89ab])/i.test(host)) throw bad("Private or loopback addresses aren't allowed.");
  }
  return url.toString();
}

export function listProducts(db: Db, brandId: string): Product[] {
  return all<ProductRow>(db, "SELECT * FROM products WHERE brand_id = ? ORDER BY updated_at DESC, id", brandId).map(toDto);
}

export function ownedProductRow(db: Db, brandId: string, id: string): ProductRow {
  const row = one<ProductRow>(db, "SELECT * FROM products WHERE id = ? AND brand_id = ?", id, brandId);
  if (!row) throw notFound("Product");
  return row;
}

export function getProduct(db: Db, brandId: string, id: string): Product {
  return toDto(ownedProductRow(db, brandId, id));
}

type ParsedInput = { name: string; description: string; landingUrl: string | null };

export function createProduct(db: Db, brandId: string, input: ParsedInput): Product {
  const landing = checkLandingUrl(input.landingUrl);
  const id = newId();
  const ts = nowIso();
  run(db, "INSERT INTO products (id, brand_id, name, description, landing_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)", id, brandId, input.name, input.description, landing, ts, ts);
  return getProduct(db, brandId, id);
}

export function updateProduct(db: Db, brandId: string, id: string, patch: Partial<ParsedInput>): Product {
  const row = ownedProductRow(db, brandId, id);
  const landing = patch.landingUrl === undefined ? row.landing_url : checkLandingUrl(patch.landingUrl);
  run(
    db,
    "UPDATE products SET name = ?, description = ?, landing_url = ?, updated_at = ? WHERE id = ?",
    patch.name ?? row.name,
    patch.description ?? row.description,
    landing,
    nowIso(),
    id,
  );
  return getProduct(db, brandId, id);
}

export type { ProductInput, ProductPatch };
