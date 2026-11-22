import { z } from "zod";
import { ErrorCode } from "./enums";

/** ISO 8601 UTC timestamp ending in Z. */
export const IsoDateTime = z.iso.datetime({ offset: false });
export const Id = z.string().min(1);
export const Cents = z.number().int().positive().max(10_000_000);

export const ActorSummary = z.object({ id: Id, displayName: z.string() });
export type ActorSummary = z.infer<typeof ActorSummary>;

export const ApiErrorBody = z.object({
  error: z.object({
    code: ErrorCode,
    message: z.string(),
    fields: z.record(z.string(), z.string()).optional(),
    /** Extra machine-readable context, e.g. { dealId } for ACTIVE_NEGOTIATION_EXISTS. */
    details: z.record(z.string(), z.unknown()).optional(),
  }),
});
export type ApiErrorBody = z.infer<typeof ApiErrorBody>;

export const dataEnvelope = <T extends z.ZodType>(schema: T) => z.object({ data: schema });

export const listOf = <T extends z.ZodType>(item: T) =>
  z.object({ items: z.array(item), nextCursor: z.string().nullable() });

export type ListOf<T> = { items: T[]; nextCursor: string | null };

/** HTTP status for each error code. */
export const ERROR_STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  AUTH_REQUIRED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  STALE_DEAL: 409,
  STALE_PROFILE: 409,
  STALE_CAMPAIGN: 409,
  BUDGET_EXCEEDED: 409,
  INVALID_STATE: 409,
  PROPOSAL_EXPIRED: 409,
  ACTIVE_NEGOTIATION_EXISTS: 409,
  PROFILE_UNAVAILABLE: 409,
  IDEMPOTENCY_CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  RETRY_LATER: 503,
  PROVIDER_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
};
