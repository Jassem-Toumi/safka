import { ZodError, type z } from "zod";
import { ApiError } from "./errors";

const NO_STORE = { "Cache-Control": "private, no-store" };

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify({ data }), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...NO_STORE, ...headers },
  });
}

export function errorResponse(err: ApiError): Response {
  const body: Record<string, unknown> = { code: err.code, message: err.message };
  if (err.fields) body.fields = err.fields;
  if (err.details) body.details = err.details;
  return new Response(JSON.stringify({ error: body }), {
    status: err.status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...NO_STORE },
  });
}

export function zodToApiError(e: ZodError): ApiError {
  const fields: Record<string, string> = {};
  for (const issue of e.issues) {
    const key = issue.path.join(".") || "_";
    if (!fields[key]) fields[key] = issue.message;
  }
  return new ApiError("VALIDATION_ERROR", "Some fields are invalid.", fields);
}

export function parse<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const r = schema.safeParse(value);
  if (!r.success) throw zodToApiError(r.error);
  return r.data;
}

export async function readJson(req: Request): Promise<unknown> {
  const ct = req.headers.get("content-type") || "";
  if (!ct.toLowerCase().includes("application/json")) {
    throw new ApiError("VALIDATION_ERROR", "Expected application/json body.");
  }
  try {
    return await req.json();
  } catch {
    throw new ApiError("VALIDATION_ERROR", "Malformed JSON body.");
  }
}

/** Convert anything thrown into the standard error envelope. */
export function toErrorResponse(e: unknown): Response {
  if (e instanceof ApiError) return errorResponse(e);
  if (e instanceof ZodError) return errorResponse(zodToApiError(e));
  // Never leak internals or secrets.
  console.error("[api] unhandled error:", e instanceof Error ? e.message : "unknown");
  return errorResponse(new ApiError("INTERNAL_ERROR", "Something went wrong."));
}
